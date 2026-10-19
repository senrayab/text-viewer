// 앱 전체가 함께 쓰는 IndexedDB
// - recent: 최근 문서·새로고침 복원 (recent.ts)
// - works, episodes, contents: 내 서재 (library.ts). 편 내용은 목록을 가볍게 읽을 수 있도록 contents에 따로 둔다.

const DB_NAME = 'text-viewer'
const VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = req.result
      if (!db.objectStoreNames.contains('recent')) db.createObjectStore('recent')
      // 버전 1에서 쓰던 'last' 칸은 더 이상 쓰지 않는다
      if (e.oldVersion === 1) req.transaction?.objectStore('recent').delete('last')
      if (!db.objectStoreNames.contains('works')) db.createObjectStore('works', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('episodes')) {
        db.createObjectStore('episodes', { keyPath: 'id' }).createIndex('workId', 'workId')
      }
      if (!db.objectStoreNames.contains('contents')) db.createObjectStore('contents')
    }
    req.onsuccess = () => {
      const db = req.result
      // 다른 탭에서 새 버전으로 올리려 하면 이 연결을 닫아 막지 않는다
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

export function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
