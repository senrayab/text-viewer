// 서재 백업 파일 — 작품, 편 정보, 편 내용(원본 txt 바이트), 표지, 읽은 위치를 파일 하나로 묶는다.
// JSON으로 만든 뒤 gzip으로 압축한다. 편 내용과 표지는 base64로 넣는다.
// 불러올 때는 지금 서재를 백업 내용으로 바꾸고, 읽은 위치는 더 최근 것을 남기며 합친다.

import { done, openDb, request } from './db'
import { episodeKey, type Episode, type Work } from './library'
import { mergePositions, readPositions, type Positions } from './storage'

const FORMAT = 'text-viewer-backup'
const VERSION = 1

interface BackupWork extends Omit<Work, 'cover'> {
  cover?: { type: string; data: string }
}

interface BackupData {
  format: typeof FORMAT
  version: number
  createdAt: number
  works: BackupWork[]
  episodes: Episode[]
  /** 편 id → 편 내용(base64) */
  contents: Record<string, string>
  positions: Positions
}

export interface BackupSummary {
  works: number
  episodes: number
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // 큰 파일에서 인수 개수 제한에 걸리지 않도록 나눠서 변환한다
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function fromBase64(text: string) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function compress(text: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' })
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' })
}

async function decompress(blob: Blob): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
  if (head[0] !== 0x1f || head[1] !== 0x8b) return blob.text()
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export async function createBackup(): Promise<{ blob: Blob } & BackupSummary> {
  const db = await openDb()
  const tx = db.transaction(['works', 'episodes', 'contents'], 'readonly')
  const [works, episodes, contentKeys, contentValues] = await Promise.all([
    request<Work[]>(tx.objectStore('works').getAll()),
    request<Episode[]>(tx.objectStore('episodes').getAll()),
    request<IDBValidKey[]>(tx.objectStore('contents').getAllKeys()),
    request<ArrayBuffer[]>(tx.objectStore('contents').getAll()),
  ])

  const contents: Record<string, string> = {}
  contentKeys.forEach((key, i) => (contents[String(key)] = toBase64(contentValues[i])))

  const backupWorks: BackupWork[] = await Promise.all(
    works.map(async ({ cover, ...work }) =>
      cover ? { ...work, cover: { type: cover.type, data: toBase64(await cover.arrayBuffer()) } } : work,
    ),
  )

  // 서재에 있는 편의 읽은 위치만 넣는다
  const all = readPositions()
  const positions: Positions = {}
  for (const e of episodes) {
    const key = episodeKey(e)
    if (all[key]) positions[key] = all[key]
  }

  const data: BackupData = {
    format: FORMAT,
    version: VERSION,
    createdAt: Date.now(),
    works: backupWorks,
    episodes,
    contents,
    positions,
  }
  return { blob: await compress(JSON.stringify(data)), works: works.length, episodes: episodes.length }
}

/** 지금 서재를 백업 내용으로 바꾼다 */
export async function restoreBackup(blob: Blob): Promise<BackupSummary> {
  let data: BackupData
  try {
    data = JSON.parse(await decompress(blob))
  } catch {
    throw new Error('invalid-backup')
  }
  if (data?.format !== FORMAT) throw new Error('invalid-backup')

  const db = await openDb()
  const tx = db.transaction(['works', 'episodes', 'contents'], 'readwrite')
  const works = tx.objectStore('works')
  const episodes = tx.objectStore('episodes')
  const contents = tx.objectStore('contents')
  works.clear()
  episodes.clear()
  contents.clear()

  for (const { cover, ...work } of data.works) {
    works.put(cover ? { ...work, cover: new Blob([fromBase64(cover.data)], { type: cover.type }) } : work)
  }
  for (const e of data.episodes) {
    episodes.put(e)
    const content = data.contents[e.id]
    if (content !== undefined) contents.put(fromBase64(content), e.id)
  }
  await done(tx)

  mergePositions(data.positions ?? {})
  return { works: data.works.length, episodes: data.episodes.length }
}
