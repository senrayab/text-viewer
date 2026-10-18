export type ThemeChoice = 'system' | 'light' | 'sepia' | 'dark'
export type FontChoice = 'sans' | 'serif' | 'mono'
export type WidthChoice = 'narrow' | 'normal' | 'wide' | 'full'

export interface Settings {
  theme: ThemeChoice
  font: FontChoice
  fontSize: number
  lineHeight: number
  width: WidthChoice
  lineNumbers: boolean
  wrap: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  font: 'sans',
  fontSize: 18,
  lineHeight: 1.8,
  width: 'normal',
  lineNumbers: false,
  wrap: true,
}

export const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'sepia', label: '세피아' },
  { value: 'dark', label: '다크' },
]

export const FONTS: { value: FontChoice; label: string; stack: string }[] = [
  {
    value: 'sans',
    label: '고딕',
    stack: '"Noto Sans KR", system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
  { value: 'serif', label: '명조', stack: '"Noto Serif KR", "Nanum Myeongjo", "Batang", Georgia, serif' },
  { value: 'mono', label: '고정폭', stack: '"JetBrains Mono", "D2Coding", Consolas, "Noto Sans KR", monospace' },
]

export const WIDTHS: { value: WidthChoice; label: string; css: string }[] = [
  { value: 'narrow', label: '좁게', css: '32em' },
  { value: 'normal', label: '보통', css: '40em' },
  { value: 'wide', label: '넓게', css: '54em' },
  { value: 'full', label: '전체', css: 'none' },
]

export const FONT_SIZE = { min: 12, max: 32, step: 1 }
export const LINE_HEIGHT = { min: 1.2, max: 2.6, step: 0.1 }

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
