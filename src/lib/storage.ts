import { DEFAULT_SETTINGS, type Settings } from '../settings'

const SETTINGS_KEY = 'text-viewer:settings'
const POSITIONS_KEY = 'text-viewer:positions'
// 서재의 편마다 진행률을 보여주므로 넉넉히 기억한다
const MAX_POSITIONS = 1000

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 설정을 기억하지 않는다
  }
}

/** line: 마지막으로 읽던 줄(1부터), progress: 스크롤 진행률(0~1), t: 마지막으로 읽은 시각 */
export interface Position {
  line: number
  t: number
  progress?: number
}

type Positions = Record<string, Position>

export function readPositions(): Positions {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** 파일별로 마지막으로 읽던 줄 번호(1부터 시작) */
export function loadPosition(key: string): number {
  return readPositions()[key]?.line ?? 1
}

export function savePosition(key: string, line: number, progress: number) {
  try {
    const all = readPositions()
    all[key] = { line, t: Date.now(), progress }
    const recent = Object.entries(all)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, MAX_POSITIONS)
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(Object.fromEntries(recent)))
  } catch {
    // 무시
  }
}
