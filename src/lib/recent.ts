// 문서 하나를 IndexedDB에 기억한다. 저장 칸은 두 개다.
// - 'recent': "최근 문서 열기"용. 설정에서 끌 수 있다.
// - 'session': 지금 보고 있는 문서. 새로고침 후 복원에 쓰고, 처음 화면으로 나가면 지운다.
// 저장하는 내용은 같다.
// - 파일 핸들(PC Chrome/Edge): 원본을 다시 읽는다. 삭제·이동되면 찾을 수 없다고 안내한다.
// - 내용 사본: 핸들이 없는 브라우저(모바일 등)에서 다시 열 때, 그리고 새로고침 후 자동 복원에 쓴다.
//   핸들은 사용자가 누른 순간에만 권한을 요청할 수 있어서 새로고침 직후 자동으로 열 수 없기 때문이다.

const DB_NAME = 'text-viewer'
const STORE = 'recent'
export type Slot = 'recent' | 'session'
/** 이 탭에서 문서를 보고 있는 중인지 — 새로고침 시 자동 복원 여부를 정한다 */
const SESSION_KEY = 'text-viewer:open'
/** 사본으로 저장할 수 있는 최대 크기 */
const MAX_COPY_SIZE = 30 * 1024 * 1024

export interface RecentEntry {
  name: string
  size: number
  lastModified: number
  handle?: FileSystemFileHandle
  buffer?: ArrayBuffer
}

export type ReopenResult = { file: File; handle?: FileSystemFileHandle } | { error: 'not-found' | 'denied' }

export function isSessionOpen() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function setSessionOpen(open: boolean) {
  try {
    if (open) sessionStorage.setItem(SESSION_KEY, '1')
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 무시
  }
}

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function store(mode: IDBTransactionMode) {
  return (await openDb()).transaction(STORE, mode).objectStore(STORE)
}

export async function loadEntry(slot: Slot): Promise<RecentEntry | undefined> {
  try {
    return await request((await store('readonly')).get(slot))
  } catch {
    return undefined
  }
}

export async function clearEntry(slot: Slot) {
  try {
    await request((await store('readwrite')).delete(slot))
  } catch {
    // 무시
  }
}

export async function saveEntry(slot: Slot, file: File, buffer: ArrayBuffer, handle?: FileSystemFileHandle) {
  const entry: RecentEntry = { name: file.name, size: file.size, lastModified: file.lastModified }
  if (handle) entry.handle = handle
  if (buffer.byteLength <= MAX_COPY_SIZE) entry.buffer = buffer
  if (!entry.handle && !entry.buffer) return clearEntry(slot)

  try {
    await request((await store('readwrite')).put(entry, slot))
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
}

function fromCopy(entry: RecentEntry) {
  return entry.buffer
    ? { file: new File([entry.buffer], entry.name, { lastModified: entry.lastModified }), handle: entry.handle }
    : undefined
}

async function readHandle(handle: FileSystemFileHandle): Promise<ReopenResult> {
  try {
    return { file: await handle.getFile(), handle }
  } catch (e) {
    return { error: (e as DOMException).name === 'NotAllowedError' ? 'denied' : 'not-found' }
  }
}

/** "최근 문서 열기" — 사용자가 누른 순간에 호출해야 권한을 요청할 수 있다 */
export async function reopenRecent(entry: RecentEntry): Promise<ReopenResult> {
  const handle = entry.handle
  if (!handle) return fromCopy(entry) ?? { error: 'not-found' }

  const granted =
    (await handle.queryPermission?.({ mode: 'read' })) === 'granted' ||
    (await handle.requestPermission?.({ mode: 'read' })) === 'granted'
  if (!granted) return fromCopy(entry) ?? { error: 'denied' }

  return readHandle(handle)
}

/** 새로고침 후 자동 복원 — 권한을 묻지 않고 열 수 있을 때만 연다 */
export async function restoreRecent(entry: RecentEntry) {
  const copy = fromCopy(entry)
  if (copy) return copy
  if (!entry.handle || (await entry.handle.queryPermission?.({ mode: 'read' })) !== 'granted') return undefined
  const result = await readHandle(entry.handle)
  return 'file' in result ? result : undefined
}
