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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
