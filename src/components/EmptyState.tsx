import { FileIcon, OpenIcon, RecentIcon } from './Icons'

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

/** 처음 화면 — 파일을 끌어다 놓는 점선 영역을 화면 가운데(조금 위)에 둔다 */
export function EmptyState({ onOpen, recentName, onOpenRecent, error }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="home">
        <div className="drop-zone">
          <span className="drop-icon">
            <FileIcon />
          </span>
          <strong>여기에 파일을 끌어다 놓거나</strong>
          <p>.txt 파일을 고르면 바로 열려요</p>
          <button className="primary with-icon" onClick={onOpen}>
            <OpenIcon />
            파일 선택
          </button>
        </div>

        {recentName && (
          <button className="recent-btn" onClick={onOpenRecent}>
            <RecentIcon />
            <span>최근 문서 열기</span>
            <span className="recent-name">{recentName}</span>
          </button>
        )}

        {error && <p className="error">{error}</p>}

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

        <p className="page-foot">파일은 이 기기 안에서만 열려요.</p>
      </div>
    </div>
  )
}
