// 구글 드라이브 백업 — 구글 로그인(Google Identity Services)으로 받은 토큰으로
// 드라이브의 앱 전용 숨김 폴더(appDataFolder)에 백업 파일 하나를 올리고 내려받는다.
// 이 범위(drive.appdata)로는 사용자의 다른 드라이브 파일에 접근할 수 없다.

import { GOOGLE_CLIENT_ID } from '../config'

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'text-viewer-backup.json.gz'
const API = 'https://www.googleapis.com'
/** 연결한 구글 계정 이메일 — 다음에 계정을 다시 묻지 않고 조용히 연결하는 데 쓴다 (이 기기에만 저장) */
const ACCOUNT_KEY = 'text-viewer:drive-account'

export const driveConfigured = !!GOOGLE_CLIENT_ID

let token: { value: string; expires: number } | null = null
let gisPromise: Promise<void> | null = null

/** 로그인 창을 사용자가 누른 순간 바로 띄울 수 있도록 미리 불러 둔다 */
export function preloadGoogle() {
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisPromise = null
      reject(new Error('google-unavailable'))
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

/** 연결한 적 있는 계정 이메일. 연결한 적이 없으면 null, 이메일을 아직 모르면 빈 문자열 */
export function connectedAccount(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY)
  } catch {
    return null
  }
}

function rememberAccount(email: string | null) {
  try {
    if (email === null) localStorage.removeItem(ACCOUNT_KEY)
    else localStorage.setItem(ACCOUNT_KEY, email)
  } catch {
    // 무시
  }
}

export function isSignedIn() {
  return !!token && token.expires > Date.now() + 60_000
}

/**
 * 접근 토큰을 받는다. 브라우저가 팝업을 막지 않도록 버튼을 누른 처리 안에서 곧바로 불러야 한다
 * (그래서 스크립트를 기다리지 않고, 아직 안 불러졌으면 실패로 돌려준다).
 * 한 번 연결한 계정이 있으면 계정 선택 없이 그 계정으로 조용히 받는다.
 */
export function signIn(): Promise<string> {
  if (token && isSignedIn()) return Promise.resolve(token.value)
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('google-unavailable'))
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'denied'))
          return
        }
        if (response.scope && !response.scope.split(' ').includes(SCOPE)) {
          reject(new Error('scope-denied'))
          return
        }
        token = { value: response.access_token, expires: Date.now() + Number(response.expires_in) * 1000 }
        if (connectedAccount() === null) rememberAccount('')
        resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(error.type ?? 'denied')),
    })
    const account = connectedAccount()
    client.requestAccessToken(account === null ? undefined : { prompt: '', login_hint: account || undefined })
  })
}

/** 연결한 계정의 이메일을 드라이브에서 읽어 기억해 둔다 */
export async function loadAccountEmail() {
  const res = await api('/drive/v3/about?fields=user(emailAddress)')
  const email: string = (await res.json()).user?.emailAddress ?? ''
  rememberAccount(email)
  return email
}

/** 연결 해제 — 이 기기에 기억한 계정을 지우고, 구글에 준 접근 권한도 거둔다 */
export function disconnect() {
  const value = token?.value
  token = null
  rememberAccount(null)
  if (value) window.google?.accounts?.oauth2?.revoke?.(value, () => {})
}

/** 올리거나 내려받은 정도 (0~1) */
export type OnProgress = (ratio: number) => void

function authHeader() {
  if (!token || !isSignedIn()) throw new Error('signed-out')
  return `Bearer ${token.value}`
}

/** 실패한 응답을 화면에 보여줄 오류 코드로 바꾼다 */
function driveError(status: number, body: string) {
  if (status === 401) {
    token = null
    return new Error('signed-out')
  }
  let reason = ''
  try {
    const json = JSON.parse(body)
    reason = json?.error?.errors?.[0]?.reason ?? json?.error?.status ?? ''
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 쓴다
  }
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) return new Error('api-disabled')
  if (status === 403 && /insufficient|PERMISSION_DENIED/i.test(reason)) {
    token = null
    return new Error('scope-denied')
  }
  return new Error(`drive-${status}${reason ? ` ${reason}` : ''}`)
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { ...init.headers, Authorization: authHeader() },
  })
  if (!res.ok) throw driveError(res.status, await res.text().catch(() => ''))
  return res
}

/** 올린 양을 알 수 있도록 fetch 대신 XMLHttpRequest로 보낸다 */
function send(method: string, path: string, body: Blob | FormData, onProgress?: OnProgress) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, API + path)
    xhr.setRequestHeader('Authorization', authHeader())
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(driveError(xhr.status, xhr.responseText)))
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(body)
  })
}

export interface DriveBackup {
  id: string
  modifiedTime: string
  size: number
}

export async function findBackup(): Promise<DriveBackup | undefined> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`)
  const res = await api(`/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&fields=files(id,modifiedTime,size)`)
  const file = (await res.json()).files?.[0]
  return file && { id: file.id, modifiedTime: file.modifiedTime, size: Number(file.size) }
}

/** 백업 파일은 하나만 둔다 — 있으면 덮어쓰고, 없으면 새로 만든다 */
export async function uploadBackup(blob: Blob, onProgress?: OnProgress) {
  const existing = await findBackup()
  if (existing) {
    await send('PATCH', `/upload/drive/v3/files/${existing.id}?uploadType=media`, blob, onProgress)
    return
  }
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }),
  )
  form.append('file', blob)
  await send('POST', '/upload/drive/v3/files?uploadType=multipart', form, onProgress)
}

/** 드라이브 앱 전용 공간의 백업 파일을 지운다 (숨겨진 공간이라 드라이브 목록에서는 지울 수 없다) */
export async function deleteBackup(id: string) {
  await api(`/drive/v3/files/${id}`, { method: 'DELETE' })
}

/** size: 백업 정보에서 알고 있는 크기 (응답에 길이가 없을 때 진행률을 재는 데 쓴다) */
export async function downloadBackup(id: string, size = 0, onProgress?: OnProgress) {
  const res = await api(`/drive/v3/files/${id}?alt=media`)
  const total = Number(res.headers.get('Content-Length')) || size
  if (!onProgress || !total || !res.body) return res.blob()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(Math.min(1, loaded / total))
  }
  return new Blob(chunks)
}
