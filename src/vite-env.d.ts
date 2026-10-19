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

interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}
