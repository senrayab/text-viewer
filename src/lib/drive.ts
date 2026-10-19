// 구글 드라이브 백업 — 구글 로그인(Google Identity Services)으로 받은 토큰으로
// 드라이브의 앱 전용 숨김 폴더(appDataFolder)에 백업 파일 하나를 올리고 내려받는다.
// 이 범위(drive.appdata)로는 사용자의 다른 드라이브 파일에 접근할 수 없다.

import { GOOGLE_CLIENT_ID } from '../config'

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'text-viewer-backup.json.gz'
const API = 'https://www.googleapis.com'

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

export function isSignedIn() {
  return !!token && token.expires > Date.now() + 60_000
}

/**
 * 접근 토큰을 받는다. 브라우저가 팝업을 막지 않도록 버튼을 누른 처리 안에서 곧바로 불러야 한다
 * (그래서 스크립트를 기다리지 않고, 아직 안 불러졌으면 실패로 돌려준다).
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
        resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(error.type ?? 'denied')),
    })
    client.requestAccessToken()
  })
}

async function api(path: string, init: RequestInit = {}) {
  if (!token || !isSignedIn()) throw new Error('signed-out')
  const res = await fetch(API + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token.value}` },
  })
  if (res.status === 401) {
    token = null
    throw new Error('signed-out')
  }
  if (!res.ok) {
    let reason = ''
    try {
      const body = await res.json()
      reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? ''
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 쓴다
    }
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) throw new Error('api-disabled')
    if (res.status === 403 && /insufficient|PERMISSION_DENIED/i.test(reason)) {
      token = null
      throw new Error('scope-denied')
    }
    throw new Error(`drive-${res.status}${reason ? ` ${reason}` : ''}`)
  }
  return res
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
export async function uploadBackup(blob: Blob) {
  const existing = await findBackup()
  if (existing) {
    await api(`/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', body: blob })
    return
  }
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }),
  )
  form.append('file', blob)
  await api('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', body: form })
}

/** 드라이브 앱 전용 공간의 백업 파일을 지운다 (숨겨진 공간이라 드라이브 목록에서는 지울 수 없다) */
export async function deleteBackup(id: string) {
  await api(`/drive/v3/files/${id}`, { method: 'DELETE' })
}

export async function downloadBackup(id: string) {
  return (await api(`/drive/v3/files/${id}?alt=media`)).blob()
}
