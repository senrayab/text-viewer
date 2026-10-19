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
// 같은 작품의 파일은 이름이 같고 끝부분만 다르다: "소설 3화", "소설 10화 상", "소설 3화 (완)", "소설 외전 2" …
// 끝부분을 떼어 내 작품 이름과 편 정보를 얻고, 아래 순서로 정렬한다.
//   프롤로그 → 본편(번호 순, 같은 번호면 상·중·하 / 전·후 순) → 숫자 없는 완결편 → 에필로그 → 외전(번호 순)

/** 편의 종류 — 정렬할 때 이 순서로 묶인다 */
export type EpisodeKind = 'prologue' | 'main' | 'final' | 'epilogue' | 'side'

const KIND_RANK: Record<EpisodeKind, number> = { prologue: 0, main: 1, final: 2, epilogue: 3, side: 4 }

export interface ParsedName {
  /** 작품 이름 후보 (끝부분을 뗀 부분) */
  base: string
  kind?: EpisodeKind
  number?: number
  /** 나뉜 편의 순서 (상·전 1, 중 2, 하 3 / 후 2) */
  part?: number
  /** (완) 같은 완결 표시가 있었는지 */
  complete?: boolean
  /** 편 이름 기본값 — "3화", "10화 상", "3화 (완)", "외전 2" 등 */
  label: string
  /** 정렬 순서 — 알아볼 수 없는 이름이면 없다 */
  order?: number
}

const SEP = String.raw`[\s_\-.·]`

/** 끝에 붙은 완결 표시: "(완)", "[완결]", " 완", " END" … (괄호가 없으면 앞에 띄어쓰기 등이 있어야 한다) */
const COMPLETE_PATTERN = new RegExp(
  String.raw`^(.+?)(?:${SEP}*[(\[]\s*(?:완결|완|完|end|fin)\s*[)\]]|${SEP}+(?:완결|완|完|end|fin))$`,
  'i',
)

/** 끝에 붙은 나뉜 편 표시: "상", "(하)", "上", "전편" … */
const PART_PATTERN = new RegExp(
  String.raw`^(.+?)(?:${SEP}*[(\[]\s*(상|중|하|上|中|下|전편|후편|전|후|前|後)\s*[)\]]|${SEP}+(상|중|하|上|中|下|전편|후편|전|후|前|後))$`,
)
const PART_RANK: Record<string, [number, string]> = {
  상: [1, '상'],
  上: [1, '상'],
  중: [2, '중'],
  中: [2, '중'],
  하: [3, '하'],
  下: [3, '하'],
  전: [1, '전'],
  전편: [1, '전편'],
  前: [1, '전'],
  후: [2, '후'],
  후편: [2, '후편'],
  後: [2, '후'],
}

/** 프롤로그·에필로그·외전 (뒤에 번호가 붙을 수 있다): "외전 2", "番外1", "(外)", "에필로그" … */
const SPECIAL_PATTERN = new RegExp(
  String.raw`^(.+?)${SEP}*[(\[]?\s*(프롤로그|서장|序章|序|에필로그|후기|외전|番外|特別編|특별편|外|외)${SEP}*(\d+)?\s*(?:화|편)?\s*[)\]]?$`,
)
const SPECIAL_KIND: Record<string, [EpisodeKind, string]> = {
  프롤로그: ['prologue', '프롤로그'],
  서장: ['prologue', '서장'],
  序章: ['prologue', '서장'],
  序: ['prologue', '서장'],
  에필로그: ['epilogue', '에필로그'],
  후기: ['epilogue', '후기'],
  외전: ['side', '외전'],
  番外: ['side', '외전'],
  特別編: ['side', '특별편'],
  특별편: ['side', '특별편'],
  外: ['side', '외전'],
  외: ['side', '외전'],
}

/** 끝에 붙은 번호: "3화", "_003", "제3화", "(5)" … */
const NUMBER_PATTERN = /^(.*?)[\s_\-.·[(]*(?:제\s*)?(\d+)\s*(화|편|권|부|장|회)?[\s\])]*$/

function cleanBase(text: string) {
  return text.replace(/^[\s[(]+|[\s_\-.·[(\])]+$/g, '').trim()
}

function orderOf(kind: EpisodeKind, number = 0, part = 0) {
  return KIND_RANK[kind] * 1_000_000 + number * 10 + part
}

/** 파일명에서 작품 이름과 편 정보를 뽑는다 */
export function parseEpisodeName(fileName: string): ParsedName {
  const name = fileName.replace(/\.[^.]+$/, '').trim()
  let rest = name

  // 1. 완결 표시
  let complete = false
  const done = rest.match(COMPLETE_PATTERN)
  if (done && cleanBase(done[1])) {
    rest = done[1]
    complete = true
  }

  // 2. 나뉜 편 (상·중·하 …)
  let part: number | undefined
  let partLabel = ''
  const split = rest.match(PART_PATTERN)
  if (split && cleanBase(split[1])) {
    ;[part, partLabel] = PART_RANK[split[2] ?? split[3]]
    rest = split[1]
  }
  const tail = (partLabel ? ` ${partLabel}` : '') + (complete ? ' (완)' : '')

  // 3. 프롤로그·에필로그·외전
  const special = rest.match(SPECIAL_PATTERN)
  if (special && cleanBase(special[1])) {
    const [kind, word] = SPECIAL_KIND[special[2]]
    const number = special[3] ? Number(special[3]) : undefined
    return {
      base: cleanBase(special[1]),
      kind,
      number,
      part,
      complete,
      label: `${word}${number !== undefined ? ` ${number}` : ''}${tail}`,
      order: orderOf(kind, number, part),
    }
  }

  // 4. 번호
  const numbered = rest.match(NUMBER_PATTERN)
  if (numbered && cleanBase(numbered[1])) {
    const number = Number(numbered[2])
    return {
      base: cleanBase(numbered[1]),
      kind: 'main',
      number,
      part,
      complete,
      label: `${number}${numbered[3] ?? '편'}${tail}`,
      order: orderOf('main', number, part),
    }
  }

  // 5. 번호 없이 나뉜 편("소설 상")은 본편, 번호 없이 완결 표시만 있으면("소설 (완)") 완결편
  if (part !== undefined) {
    return { base: cleanBase(rest), kind: 'main', part, complete, label: partLabel + (complete ? ' (완)' : ''), order: orderOf('main', 0, part) }
  }
  if (complete) {
    return { base: cleanBase(rest), kind: 'final', complete, label: '완결', order: orderOf('final') }
  }

  return { base: name, label: name }
}

/**
 * 파일명을 한꺼번에 읽는다. 1편에는 번호를 안 붙이고 2편부터 "제목 (2)", "제목 (3)"처럼 붙이는 경우가 많아서,
 * 번호 없는 "제목"이 같은 이름의 2편 이후와 함께 있으면(1편은 없을 때) 그 파일을 1편으로 본다.
 * known: 함께 따져 볼 다른 파일명(이미 서재에 있는 편 등) — 결과에는 들어가지 않는다
 */
export function parseEpisodeNames(names: string[], known: string[] = []): ParsedName[] {
  const parsed = names.map(parseEpisodeName)
  // 작품 이름 → 2편 이후에 쓴 단위(화·편 …), 1편이 이미 있는 작품 이름
  const later = new Map<string, string>()
  const hasFirst = new Set<string>()
  for (const p of [...parsed, ...known.map(parseEpisodeName)]) {
    if (p.kind !== 'main' || p.number === undefined) continue
    const key = p.base.toLowerCase()
    if (p.number === 1) hasFirst.add(key)
    else if (p.number > 1 && !later.has(key)) later.set(key, p.label.match(/^\d+(화|편|권|부|장|회)/)?.[1] ?? '편')
  }
  return parsed.map((p) => {
    const key = p.base.toLowerCase()
    if (p.kind || !later.has(key) || hasFirst.has(key)) return p
    return { base: p.base, kind: 'main', number: 1, label: `1${later.get(key)}`, order: orderOf('main', 1) }
  })
}

const collator = new Intl.Collator('ko', { numeric: true })

/** 편 정렬 — 파일명에서 순서를 다시 계산한다(규칙이 바뀌어도 이미 담은 편이 함께 맞춰진다). 알아볼 수 없는 이름은 담은 순서. */
function sortEpisodes(list: Episode[]) {
  const parsed = parseEpisodeNames(list.map((e) => e.fileName))
  const key = new Map(list.map((e, i) => [e.id, parsed[i].order ?? orderOf('main', e.order)]))
  return list.sort((a, b) => key.get(a.id)! - key.get(b.id)! || collator.compare(a.fileName, b.fileName))
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
    g.files.sort(
      (a, b) =>
        (a.parsed.order ?? Number.MAX_SAFE_INTEGER) - (b.parsed.order ?? Number.MAX_SAFE_INTEGER) ||
        collator.compare(a.file.name, b.file.name),
    )
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
        patchWork(w.id, { coverHue }).catch(() => {})
      }),
  )
  // 예전에 크게 저장된 표지는 줄여서 다시 저장한다 (화면은 다음에 열 때부터 작은 표지를 쓴다)
  for (const w of works) {
    if (!w.cover || w.cover.size <= COVER_SHRINK_BYTES) continue
    const original = w.cover
    prepareCover(original)
      .then((cover) => (cover.size < original.size ? patchWork(w.id, { cover }) : undefined))
      .catch(() => {})
  }
  // 1편으로 보게 된 번호 없는 편은, 이름을 직접 바꾸지 않았다면 편 이름도 "1편"으로 고쳐 둔다
  for (const list of byWork.values()) {
    const parsed = parseEpisodeNames(list.map((e) => e.fileName))
    list.forEach((e, i) => {
      if (parsed[i].label === e.title || e.title !== parseEpisodeName(e.fileName).label) return
      e.title = parsed[i].label
      patchEpisode(e.id, { title: e.title }).catch(() => {})
    })
  }
  return works.map((work) => ({ work, episodes: sortEpisodes(byWork.get(work.id) ?? []) }))
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
  // 읽기 전도 막대와 같은 0%로 보여준다 (서재·목록 모두 막대+퍼센트로 통일)
  if (progress === undefined) return { label: '0%', percent: 0, started: false, finished: false }
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

/** 앱이 알아서 고쳐 두는 편 정보 */
async function patchEpisode(id: string, changes: Pick<Episode, 'title'>) {
  const db = await openDb()
  const tx = db.transaction('episodes', 'readwrite')
  const store = tx.objectStore('episodes')
  const episode = await request<Episode | undefined>(store.get(id))
  if (episode) store.put({ ...episode, ...changes })
  await done(tx)
}

/** 표지 색·크기처럼 앱이 알아서 고쳐 두는 값. 이용자가 작품을 고친 것은 아니므로 수정 시각은 그대로 둔다 */
async function patchWork(id: string, changes: Pick<Work, 'cover'> | Pick<Work, 'coverHue'>) {
  const db = await openDb()
  const tx = db.transaction('works', 'readwrite')
  const store = tx.objectStore('works')
  const work = await request<Work | undefined>(store.get(id))
  if (work) store.put({ ...work, ...changes })
  await done(tx)
}

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

// 표지는 가장 크게 보여도 폭 160px 남짓이라, 고해상도 화면(3배)에서도 이 크기면 충분하다
const COVER_MAX_WIDTH = 480
const COVER_MAX_HEIGHT = 720
// 이보다 큰 표지는 예전 방식으로 저장된 것으로 보고 서재를 열 때 한 번 줄여 둔다
const COVER_SHRINK_BYTES = 150 * 1024

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/** 표지 이미지는 저장 공간을 아끼도록 줄이고 WebP로(지원하지 않는 브라우저는 JPEG로) 바꿔 저장한다 */
export async function prepareCover(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, COVER_MAX_WIDTH / bitmap.width, COVER_MAX_HEIGHT / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  // 투명한 PNG가 JPEG로 바뀌면 검게 나오지 않도록 흰 바탕을 깐다
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // WebP를 못 만드는 브라우저(예전 사파리)는 PNG를 돌려주므로 그때는 JPEG로 다시 만든다
  const webp = await encode(canvas, 'image/webp', 0.8)
  const blob = webp?.type === 'image/webp' ? webp : await encode(canvas, 'image/jpeg', 0.82)
  if (!blob) throw new Error('cover')
  return blob
}
