export type ThemeChoice = 'system' | 'light' | 'sepia' | 'dark'
export type FontChoice = 'sans' | 'serif' | 'mono'
export type WidthChoice = 'narrow' | 'normal' | 'wide' | 'full'
/** 이미지 없는 표지의 색: 기본(회베이지)·모노(슬레이트 그레이)는 한 색으로 통일, 파스텔은 제목마다 다른 색 */
export type CoverChoice = 'sand' | 'mono' | 'pastel'

export interface Settings {
  theme: ThemeChoice
  cover: CoverChoice
  font: FontChoice
  fontSize: number
  lineHeight: number
  width: WidthChoice
  lineNumbers: boolean
  wrap: boolean
  /** 처음 화면의 "최근 문서 열기"를 위해 마지막 문서를 기억한다 (새로고침 복원과는 별개) */
  rememberRecent: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  cover: 'sand',
  font: 'sans',
  fontSize: 16,
  lineHeight: 1.7,
  width: 'wide',
  lineNumbers: false,
  wrap: true,
  rememberRecent: true,
}

export const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'sepia', label: '세피아' },
  { value: 'dark', label: '다크' },
]

export const COVERS: { value: CoverChoice; label: string }[] = [
  { value: 'sand', label: '기본' },
  { value: 'mono', label: '모노' },
  { value: 'pastel', label: '파스텔' },
]

// 이모지는 Tossface로 그린다. 반드시 본문 글꼴 뒤에 둬야 한다 —
// 앞에 두면 unicode-range에서 숫자를 빼도 Chrome이 숫자와 마침표를 Tossface로 그린다.
export const FONTS: { value: FontChoice; label: string; stack: string }[] = [
  {
    value: 'sans',
    label: '고딕',
    stack: '"Pretendard Variable", Pretendard, Tossface, system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
  { value: 'serif', label: '명조', stack: '"Noto Serif KR", "Nanum Myeongjo", Tossface, "Batang", Georgia, serif' },
  {
    value: 'mono',
    label: '고정폭',
    stack: '"JetBrains Mono", "D2Coding", Consolas, "Pretendard Variable", Pretendard, Tossface, monospace',
  },
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
