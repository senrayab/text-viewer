import { RecentIcon } from './Icons'

const SHORTCUTS: [string, string][] = [
  ['Ctrl O', '파일 열기'],
  ['Ctrl F', '검색'],
  ['Ctrl G', '줄 이동'],
  ['F', '집중 모드'],
  ['T', '테마 전환'],
  ['+ / −', '글자 크기'],
  ['L', '줄 번호'],
  ['W', '자동 줄바꿈'],
]

interface EmptyStateProps {
  onOpen: () => void
  recentName?: string
  onOpenRecent: () => void
  error: string | null
}

export function EmptyState({ onOpen, recentName, onOpenRecent, error }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="drop-zone">
          <h1>텍스트 파일을 열어보세요</h1>
          <p>.txt 파일을 이곳에 끌어다 놓거나</p>
          <button className="primary" onClick={onOpen}>
            파일 선택
          </button>
          {error && <p className="error">{error}</p>}
        </div>
        {recentName && (
          <button className="recent-btn" onClick={onOpenRecent}>
            <RecentIcon />
            <span>최근 문서 열기</span>
            <span className="recent-name">{recentName}</span>
          </button>
        )}
        <dl className="shortcuts">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key}>
              <dt>
                <kbd>{key}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
