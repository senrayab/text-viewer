import { COVERS, DEFAULT_SETTINGS, type Settings } from '../settings'

const SETTINGS_KEY = 'text-viewer:settings'
const POSITIONS_KEY = 'text-viewer:positions'
// 서재의 편마다 진행률을 보여주므로 넉넉히 기억한다
const MAX_POSITIONS = 1000

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const settings: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    // 없어진 표지 색(예전 기본이던 청록 'ink')은 지금 기본으로 바꾼다
    if (!COVERS.some((c) => c.value === settings.cover)) settings.cover = DEFAULT_SETTINGS.cover
    return settings
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

export type Positions = Record<string, Position>

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

function writePositions(all: Positions) {
  const recent = Object.entries(all)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, MAX_POSITIONS)
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(Object.fromEntries(recent)))
}

export function savePosition(key: string, line: number, progress: number) {
  try {
    const all = readPositions()
    all[key] = { line, t: Date.now(), progress }
    writePositions(all)
  } catch {
    // 무시
  }
}

/** 백업에서 가져온 읽은 위치를 합친다. 같은 파일이면 더 최근에 읽은 쪽을 남긴다. */
export function mergePositions(incoming: Positions) {
  try {
    const all = readPositions()
    for (const [key, value] of Object.entries(incoming)) {
      if (!all[key] || all[key].t < value.t) all[key] = value
    }
    writePositions(all)
  } catch {
    // 무시
  }
}
