/// <reference types="vite/client" />

declare const __BUILD_ID__: string

// File System Access API — Chromium 계열에만 있고 TypeScript 기본 타입에는 아직 없다
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface OpenFilePickerOptions {
  types?: { description?: string; accept: Record<string, string[]> }[]
  multiple?: boolean
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
}

// 앱 설치 안내 — Chromium 계열에만 있다
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}

// 구글 로그인(Google Identity Services) — 드라이브 백업에서 쓰는 부분만
interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number | string
  /** 실제로 허용된 권한 목록 (공백으로 구분) */
  scope?: string
  error?: string
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void
}

interface Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient(config: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
          error_callback?: (error: { type?: string }) => void
        }): GoogleTokenClient
      }
    }
  }
}

interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}
