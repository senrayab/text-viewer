// 내 서재 — 작품(work)과 그 아래 편(episode)을 IndexedDB에 담아 둔다.
// 원본 파일과 상관없이 꺼내 볼 수 있도록 편 내용(사본)을 함께 저장한다.

import { done, openDb, request } from './db'
import type { Position } from './storage'

export interface Work {
  id: string
  title: string
  /** 직접 등록한 표지 이미지. 없으면 제목으로 표지를 그린다. */
  cover?: Blob
  /** 표지 이미지의 대표 색상값(0~360). 카드 배경과 진행 막대 색에 쓴다. */
  coverHue?: number
  createdAt: number
  updatedAt: number
}

export interface Episode {
  id: string
  workId: string
  title: string
  fileName: string
  size: number
  lastModified: number
  /** 편 순서. 파일명에 번호가 있으면 그 번호를 쓴다. */
  order: number
  addedAt: number
}

export interface WorkSummary {
  work: Work
  /** order 순으로 정렬된 편 목록 */
  episodes: Episode[]
}

/** 다 읽었다고 보는 진행률 */
export const FINISHED = 0.97

/** 읽던 위치(storage.ts)와 같은 키 — 파일을 열 때의 문서 키와 맞춘다 */
export function episodeKey(e: Pick<Episode, 'fileName' | 'size' | 'lastModified'>) {
  return `${e.fileName}:${e.size}:${e.lastModified}`
}

// crypto.randomUUID는 https·localhost에서만 있어서, LAN 주소로 띄운 개발 서버에서도 동작하도록 직접 만든다
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ── 파일명 해석 ─────────────────────────────────

export interface ParsedName {
  /** 작품 이름 후보 (번호를 뺀 부분) */
  base: string
  number?: number
  /** 편 이름 기본값 — "3화", "12편" 등 */
  label: string
}

const EPISODE_PATTERN = /^(.*?)[\s_\-.[(]*(?:제\s*)?(\d+)\s*(화|편|권|부|장|회)?[\s\])]*$/

/** "소설 3화.txt", "소설_003.txt", "[소설] 제3화.txt" 등에서 작품 이름과 편 번호를 뽑는다 */
export function parseEpisodeName(fileName: string): ParsedName {
  const name = fileName.replace(/\.[^.]+$/, '').trim()
  const m = name.match(EPISODE_PATTERN)
  const base = m?.[1].replace(/^[\s[(]+|[\s_\-.[(\])]+$/g, '').trim()
  if (!m || !base) return { base: name, label: name }
  const number = Number(m[2])
  return { base, number, label: `${number}${m[3] ?? '편'}` }
}

const collator = new Intl.Collator('ko', { numeric: true })

function compareEpisodes(a: Episode, b: Episode) {
  return a.order - b.order || collator.compare(a.fileName, b.fileName)
}

export interface PendingFile {
  file: File
  buffer: ArrayBuffer
  parsed: ParsedName
}

export interface PendingGroup {
  /** 담을 작품: 기존 작품 id 또는 'new' */
  target: string
  /** 새 작품일 때의 이름 */
  title: string
  files: PendingFile[]
}

/** 파일명이 같은 작품 이름을 가진 파일끼리 묶고, 같은 이름의 작품이 서재에 있으면 그 작품을 고른다 */
export function groupFiles(files: PendingFile[], works: Work[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>()
  for (const f of files) {
    const key = f.parsed.base.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      const existing = works.find((w) => w.title.toLowerCase() === key)
      group = { target: existing?.id ?? 'new', title: f.parsed.base, files: [] }
      groups.set(key, group)
    }
    group.files.push(f)
  }
  for (const g of groups.values()) {
    g.files.sort((a, b) => (a.parsed.number ?? 0) - (b.parsed.number ?? 0) || collator.compare(a.file.name, b.file.name))
  }
  return [...groups.values()]
}

// ── 읽기 ────────────────────────────────────────

export async function listLibrary(): Promise<WorkSummary[]> {
  const db = await openDb()
  const tx = db.transaction(['works', 'episodes'], 'readonly')
  const [works, episodes] = await Promise.all([
    request<Work[]>(tx.objectStore('works').getAll()),
    request<Episode[]>(tx.objectStore('episodes').getAll()),
  ])
  const byWork = new Map<string, Episode[]>()
  for (const e of episodes) {
    const list = byWork.get(e.workId)
    if (list) list.push(e)
    else byWork.set(e.workId, [e])
  }
  await Promise.all(
    works
      .filter((w) => w.cover && w.coverHue === undefined)
      .map(async (w) => {
        const coverHue = await extractHue(w.cover!).catch(() => undefined)
        if (coverHue === undefined) return
        w.coverHue = coverHue
        updateWork(w.id, { coverHue }).catch(() => {})
      }),
  )
  return works.map((work) => ({ work, episodes: (byWork.get(work.id) ?? []).sort(compareEpisodes) }))
}

export async function loadEpisodeFile(episode: Episode): Promise<File | undefined> {
  const db = await openDb()
  const buffer = await request<ArrayBuffer | undefined>(db.transaction('contents').objectStore('contents').get(episode.id))
  return buffer && new File([buffer], episode.fileName, { lastModified: episode.lastModified })
}

/**
 * 지금 읽을 차례인 편과 그 까닭.
 * - start: 아직 아무것도 안 읽음 → 첫 편
 * - continue: 마지막으로 읽던 편을 다 안 읽음 → 그 편 (또는 읽다 만 다른 편)
 * - next: 마지막으로 읽던 편을 다 읽음 → 그 뒤의 다 안 읽은 첫 편, 뒤에 없으면 앞에서 건너뛴 편
 * - restart: 전부 다 읽음 → 첫 편부터 다시
 */
export type ReadingTurn = 'start' | 'continue' | 'next' | 'restart'

export function continueEpisode(
  summary: WorkSummary,
  positions: Record<string, Position>,
): { episode: Episode; turn: ReadingTurn } {
  const { episodes } = summary
  const progressOf = (e: Episode) => positions[episodeKey(e)]?.progress
  const unfinished = (e: Episode) => (progressOf(e) ?? 0) < FINISHED

  let latest: Episode | undefined
  let latestTime = 0
  for (const e of episodes) {
    const t = positions[episodeKey(e)]?.t ?? 0
    if (t > latestTime) {
      latest = e
      latestTime = t
    }
  }
  if (!latest) return { episode: episodes[0], turn: 'start' }
  if (unfinished(latest)) return { episode: latest, turn: 'continue' }

  const after = episodes.slice(episodes.indexOf(latest) + 1).find(unfinished)
  const target = after ?? episodes.find(unfinished)
  if (!target) return { episode: episodes[0], turn: 'restart' }
  return { episode: target, turn: progressOf(target) === undefined ? 'next' : 'continue' }
}

export function episodeStatus(position?: Position) {
  const progress = position?.progress
  if (progress === undefined) return { label: '읽기 전', percent: 0, started: false, finished: false }
  if (progress >= FINISHED) return { label: '100%', percent: 100, started: true, finished: true }
  const percent = Math.round(progress * 100)
  return { label: `${percent}%`, percent, started: true, finished: false }
}

/** 작품 전체의 읽은 정도 — percent는 편별 진행률의 평균 */
export function workProgress(summary: WorkSummary, positions: Record<string, Position>) {
  const statuses = summary.episodes.map((e) => episodeStatus(positions[episodeKey(e)]))
  const finished = statuses.filter((s) => s.finished).length
  return {
    percent: Math.round(statuses.reduce((n, s) => n + s.percent, 0) / Math.max(1, statuses.length)),
    finished,
    started: statuses.some((s) => s.started),
    done: statuses.length > 0 && finished === statuses.length,
  }
}

export function lastReadAt(summary: WorkSummary, positions: Record<string, Position>) {
  return Math.max(0, ...summary.episodes.map((e) => positions[episodeKey(e)]?.t ?? 0))
}

// ── 쓰기 ────────────────────────────────────────

/**
 * 묶음별로 작품을 만들거나 기존 작품에 편을 더한다. 같은 파일이 이미 그 작품에 있으면 건너뛴다.
 * added: 새로 담은 편 수, skipped: 이미 있어서 건너뛴 편 수
 */
export async function addToLibrary(groups: PendingGroup[]) {
  // 브라우저가 저장 공간 부족 시 서재를 임의로 지우지 않도록 요청한다
  navigator.storage?.persist?.().catch(() => {})

  const db = await openDb()
  const tx = db.transaction(['works', 'episodes', 'contents'], 'readwrite')
  const works = tx.objectStore('works')
  const episodes = tx.objectStore('episodes')
  const contents = tx.objectStore('contents')
  const now = Date.now()
  let added = 0
  let skipped = 0

  for (const group of groups) {
    let work: Work
    if (group.target === 'new') {
      work = { id: uid(), title: group.title.trim() || group.files[0].parsed.base, createdAt: now, updatedAt: now }
    } else {
      const existing = await request<Work | undefined>(works.get(group.target))
      if (!existing) continue
      work = { ...existing, updatedAt: now }
    }
    works.put(work)

    const current = await request<Episode[]>(episodes.index('workId').getAll(work.id))
    const keys = new Set(current.map(episodeKey))
    let nextOrder = Math.max(0, ...current.map((e) => e.order)) + 1

    for (const { file, buffer, parsed } of group.files) {
      const key = episodeKey({ fileName: file.name, size: file.size, lastModified: file.lastModified })
      if (keys.has(key)) {
        skipped++
        continue
      }
      keys.add(key)
      const episode: Episode = {
        id: uid(),
        workId: work.id,
        title: parsed.label,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        order: parsed.number ?? nextOrder++,
        addedAt: now,
      }
      episodes.put(episode)
      contents.put(buffer, episode.id)
      added++
    }
  }

  await done(tx)
  return { added, skipped }
}

type WorkChanges = Partial<Pick<Work, 'title' | 'cover' | 'coverHue'>>

export async function updateWork(id: string, changes: WorkChanges) {
  const db = await openDb()
  const tx = db.transaction('works', 'readwrite')
  const store = tx.objectStore('works')
  const work = await request<Work | undefined>(store.get(id))
  if (!work) return
  const next = { ...work, ...changes, updatedAt: Date.now() }
  // undefined로 넘긴 항목은 지운다 (표지 지우기 등)
  for (const key of Object.keys(changes) as (keyof WorkChanges)[]) {
    if (changes[key] === undefined) delete next[key]
  }
  store.put(next)
  await done(tx)
}

/**
 * 이미지의 대표 색상값을 구한다. 채도가 높은 픽셀일수록 크게 쳐서 색상환 위의 평균을 낸다.
 * 거의 무채색인 이미지면 undefined를 돌려주고, 그때는 제목에서 만든 색을 쓴다.
 */
export async function extractHue(image: Blob): Promise<number | undefined> {
  const bitmap = await createImageBitmap(image)
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()
  const data = ctx.getImageData(0, 0, size, size).data

  let x = 0
  let y = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = max - min
    if (chroma < 0.08) continue
    let hue: number
    if (max === r) hue = ((g - b) / chroma) % 6
    else if (max === g) hue = (b - r) / chroma + 2
    else hue = (r - g) / chroma + 4
    const angle = (hue * 60 * Math.PI) / 180
    x += Math.cos(angle) * chroma
    y += Math.sin(angle) * chroma
    total += chroma
  }
  if (total < size * size * 0.03) return undefined
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

export async function deleteEpisode(episode: Episode) {
  const db = await openDb()
  const tx = db.transaction(['works', 'episodes', 'contents'], 'readwrite')
  tx.objectStore('episodes').delete(episode.id)
  tx.objectStore('contents').delete(episode.id)
  // 마지막 편을 지우면 작품도 지운다
  const rest = await request<IDBValidKey[]>(tx.objectStore('episodes').index('workId').getAllKeys(episode.workId))
  if (rest.every((id) => id === episode.id)) tx.objectStore('works').delete(episode.workId)
  await done(tx)
}

export async function deleteWork(id: string) {
  const db = await openDb()
  const tx = db.transaction(['works', 'episodes', 'contents'], 'readwrite')
  const ids = await request<IDBValidKey[]>(tx.objectStore('episodes').index('workId').getAllKeys(id))
  for (const episodeId of ids) {
    tx.objectStore('episodes').delete(episodeId)
    tx.objectStore('contents').delete(episodeId)
  }
  tx.objectStore('works').delete(id)
  await done(tx)
}

/** 표지 이미지는 저장 공간을 아끼도록 줄여서 저장한다 */
export async function prepareCover(file: File, maxWidth = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('cover'))), 'image/jpeg', 0.85),
  )
}
