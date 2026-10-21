import { formatBytes } from '../lib/hooks'
import { CheckIcon, CloseIcon, FileIcon, OpenIcon, RecentIcon } from './Icons'

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

/** 큰 파일을 읽는 동안 점선 영역 자리에 보여주는 카드: 읽는 중 → 다 읽음(체크) → 사라짐 */
export interface FileLoad {
  name: string
  size: number
  loaded: number
  stage: 'loading' | 'done' | 'leave'
}

interface EmptyStateProps {
  onOpen: () => void
  recentName?: string
  onOpenRecent: () => void
  error: string | null
  load?: FileLoad | null
  onCancelLoad: () => void
}

/** 처음 화면 — 파일을 끌어다 놓는 점선 영역을 화면 가운데(조금 위)에 둔다 */
export function EmptyState({ onOpen, recentName, onOpenRecent, error, load, onCancelLoad }: EmptyStateProps) {
  const pct = load ? Math.round((load.loaded / (load.size || 1)) * 100) : 0
  return (
    <div className="empty">
      <div className="home">
        {/* 파일을 놓으면 같은 자리에서 불러오는 카드로 바뀐다 (두 내용을 겹쳐 두고 번갈아 보여준다) */}
        <div className={`drop-zone${load ? ` loading ${load.stage}` : ''}`}>
          <div className="drop-idle" aria-hidden={!!load}>
            <span className="drop-icon">
              <FileIcon />
            </span>
            <strong>여기에 파일을 끌어다 놓거나</strong>
            <p>.txt 파일을 고르면 바로 열려요</p>
            <button className="primary with-icon" onClick={onOpen} tabIndex={load ? -1 : undefined}>
              <OpenIcon />
              파일 선택
            </button>
          </div>

          {load && (
            <div className="drop-load" role="status">
              <div className="load-badge">
                <span className="load-file">
                  <FileIcon />
                </span>
                <span className="load-done">
                  <CheckIcon size={22} />
                </span>
              </div>
              <div className="load-msg">
                <div className="msg-loading">
                  <strong>파일을 불러오고 있어요</strong>
                  <p>큰 파일은 조금 걸려요. 잠시만 기다려 주세요.</p>
                </div>
                <div className="msg-done">
                  <strong>다 불러왔어요</strong>
                  <p>바로 열어 드릴게요.</p>
                </div>
              </div>
              <div className="load-file-row">
                <span className="load-file-icon">
                  <FileIcon size={22} />
                </span>
                <div className="load-file-main">
                  <div className="load-file-top">
                    <span className="load-name">{load.name}</span>
                    <span className="load-pct">{pct}%</span>
                  </div>
                  <div className="load-track">
                    <div className="load-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="load-size">
                    {formatBytes(load.loaded)} / {formatBytes(load.size)}
                  </span>
                </div>
                <button className="icon-btn small load-cancel" onClick={onCancelLoad} title="취소">
                  <CloseIcon size={16} />
                </button>
              </div>
            </div>
          )}
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
