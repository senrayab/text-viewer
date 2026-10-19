import { useEffect, useState } from 'react'
import type { ThemeChoice } from '../settings'

export function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const darkQuery = '(prefers-color-scheme: dark)'

export function useResolvedTheme(theme: ThemeChoice) {
  const [systemDark, setSystemDark] = useState(() => matchMedia(darkQuery).matches)
  useEffect(() => {
    const media = matchMedia(darkQuery)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000

/** 배포된 version.json의 빌드 ID가 현재 실행 중인 것과 다르면 true */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV || available) return
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        const { id } = await res.json()
        if (id && id !== __BUILD_ID__) setAvailable(true)
      } catch {
        // 오프라인 등은 다음 확인 때 다시 시도
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const timer = setInterval(check, UPDATE_CHECK_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [available])
  return available
}

/** Blob을 화면에 쓸 수 있는 URL로 바꾸고, 쓰지 않게 되면 해제한다 */
export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
