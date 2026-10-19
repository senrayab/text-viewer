import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  continueEpisode,
  episodeKey,
  episodeStatus,
  workProgress,
  type Episode,
  type WorkSummary,
} from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover, workHue } from './Cover'
import {
  AddIcon,
  BookIcon,
  CoverIcon,
  CoverRemoveIcon,
  DoneIcon,
  EditIcon,
  ReadingIcon,
  SortIcon,
  TrashIcon,
  UnreadIcon,
} from './Icons'

type EpisodeOrder = 'first' | 'latest'

/** 편이 이보다 많으면 목록을 구간(1–50, 51–100 …)으로 나눠 탭으로 고른다 */
const RANGE_SIZE = 50

/** 읽을 차례인 편에 다는 꼬리표 */
const TURN_BADGE = { start: '처음', continue: '이어 읽기', next: '다음 편', restart: '' } as const

const ORDER_KEY = 'text-viewer:episode-order'

function loadOrder(): EpisodeOrder {
  try {
    return localStorage.getItem(ORDER_KEY) === 'latest' ? 'latest' : 'first'
  } catch {
    return 'first'
  }
}

interface WorkDetailProps {
  summary: WorkSummary
  positions: Record<string, Position>
  onOpenEpisode: (episode: Episode) => void
  onRename: (title: string) => void
  onCover: (file: File | null) => void
  onAddEpisodes: () => void
  onDeleteEpisode: (episode: Episode) => void
  onDeleteWork: () => void
}

export function WorkDetail({
  summary,
  positions,
  onOpenEpisode,
  onRename,
  onCover,
  onAddEpisodes,
  onDeleteEpisode,
  onDeleteWork,
}: WorkDetailProps) {
  const { work, episodes } = summary
  const [editing, setEditing] = useState(false)
  const [order, setOrder] = useState<EpisodeOrder>(loadOrder)

  const toggleOrder = () => {
    const nextOrder = order === 'first' ? 'latest' : 'first'
    setOrder(nextOrder)
    try {
      localStorage.setItem(ORDER_KEY, nextOrder)
    } catch {
      // 무시
    }
  }
  const [title, setTitle] = useState(work.title)
  useEffect(() => setTitle(work.title), [work.title])

  const statuses = episodes.map((e) => episodeStatus(positions[episodeKey(e)]))
  const progress = workProgress(summary, positions)
  const { episode: next, turn } = continueEpisode(summary, positions)
  const style = { '--h': workHue(work) } as CSSProperties

  const commitTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== work.title) onRename(trimmed)
    else setTitle(work.title)
  }

  // 어느 편인지는 목록의 꼬리표가 알려주므로 버튼은 짧게
  const ctaLabel = { start: '읽기 시작', continue: '이어 읽기', next: '다음 편 읽기', restart: '다시 읽기' }[turn]

  // ── 긴 연재: 구간 탭 ──
  // 구간은 편 순서(1편부터)로 나누고, 탭과 목록의 방향은 정렬 순서를 따른다
  const nextIndex = episodes.findIndex((e) => e.id === next.id)
  const rangeCount = Math.ceil(episodes.length / RANGE_SIZE)
  const ranges = Array.from({ length: rangeCount }, (_, i) => ({
    index: i,
    from: i * RANGE_SIZE + 1,
    to: Math.min((i + 1) * RANGE_SIZE, episodes.length),
  }))
  // 처음에는 읽을 차례인 편이 있는 구간을 연다 (다 읽었으면 첫 구간)
  const [range, setRange] = useState(() => (turn === 'restart' ? 0 : Math.floor(Math.max(0, nextIndex) / RANGE_SIZE)))
  const current = ranges[Math.min(range, rangeCount - 1)] ?? ranges[0]
  const inRange = rangeCount > 1 ? episodes.slice(current.from - 1, current.to) : episodes
  const visible = order === 'first' ? inRange : [...inRange].reverse()

  // ── 작품을 열면 읽을 차례인 편이 화면 가운데쯤 오도록 내려간다 ──
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const row = listRef.current?.querySelector('.tl-item.next')
    if (!row) return
    const rect = row.getBoundingClientRect()
    // 이미 화면 안에 보이면 그대로 둔다
    if (rect.top > 0 && rect.bottom < window.innerHeight - 40) return
    row.scrollIntoView({ block: 'center' })
    // 작품을 처음 열 때만
    // (구간을 바꾸거나 정렬을 바꿀 때는 사용자가 보던 곳을 지킨다)
  }, [work.id])

  return (
    <div className="page-scroll">
      <div className="page work" style={style}>
        <header className="work-hero">
          <div className="work-cover">
            <Cover title={work.title} image={work.cover} size="sm" />
          </div>
          <div className="work-info">
            {editing ? (
              <input
                className="text-input title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                aria-label="작품 이름"
              />
            ) : (
              <h1 className="display">{work.title}</h1>
            )}
            {/* 아직 한 편도 안 읽었으면 막대 대신 아래 설명의 "읽기 전"만 보여준다 */}
            {progress.started && (
              <div className="book-progress work-progress">
                <span className="bar">
                  <span style={{ width: `${progress.done ? 100 : progress.percent}%` }} />
                </span>
                <span className="book-pct">{progress.done ? 100 : progress.percent}%</span>
              </div>
            )}
            <p className="work-meta">
              전체 {episodes.length}편
              {progress.done
                ? ' · 다 읽었어요'
                : !progress.started
                  ? ' · 읽기 전'
                  : episodes.length > 1
                    ? ` · ${episodes.length - progress.finished}편 남음`
                    : ''}
            </p>
          </div>
          <button
            className={`round-btn hero-edit${editing ? ' dark' : ''}`}
            onClick={() => setEditing((v) => !v)}
            title={editing ? '편집 끝내기' : '편집'}
          >
            <EditIcon />
          </button>
        </header>

        {editing && (
          <div className="opt-list edit-list">
            <label className="opt opt-link">
              <span className="opt-main">
                <span className="opt-icon">
                  <CoverIcon />
                </span>
                <span className="opt-text">
                  <span className="opt-title">표지 이미지 {work.cover ? '바꾸기' : '등록'}</span>
                  <span className="opt-desc">사진이나 이미지를 표지로 써요</span>
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onCover(file)
                  e.target.value = ''
                }}
              />
            </label>
            {work.cover && (
              <button className="opt opt-link" onClick={() => onCover(null)}>
                <span className="opt-main">
                  <span className="opt-icon">
                    <CoverRemoveIcon />
                  </span>
                  <span className="opt-text">
                    <span className="opt-title">표지 이미지 지우기</span>
                    <span className="opt-desc">제목으로 만든 표지로 돌아가요</span>
                  </span>
                </span>
              </button>
            )}
            <button className="opt opt-link" onClick={onAddEpisodes}>
              <span className="opt-main">
                <span className="opt-icon">
                  <AddIcon />
                </span>
                <span className="opt-text">
                  <span className="opt-title">편 추가하기</span>
                  <span className="opt-desc">이 작품에 txt 파일을 더 담아요</span>
                </span>
              </span>
            </button>
            <button className="opt opt-link danger" onClick={onDeleteWork}>
              <span className="opt-main">
                <span className="opt-icon">
                  <TrashIcon />
                </span>
                <span className="opt-text">
                  <span className="opt-title">작품 삭제</span>
                  <span className="opt-desc">이 작품과 모든 편을 서재에서 지워요</span>
                </span>
              </span>
            </button>
          </div>
        )}

        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <span className="section-label">EPISODES · {episodes.length}</span>
              {episodes.length > 1 && (
                <button className="sort-btn" onClick={toggleOrder} title="정렬 순서 바꾸기">
                  <SortIcon />
                  {order === 'first' ? '1편부터' : '최신순'}
                </button>
              )}
            </div>
            <button className="pill small dark with-icon" onClick={() => onOpenEpisode(next)}>
              <BookIcon size={14} />
              {ctaLabel}
            </button>
          </div>
          {rangeCount > 1 && (
            <div className="tabs range-tabs" role="tablist">
              {(order === 'first' ? ranges : [...ranges].reverse()).map((r) => (
                <button
                  key={r.index}
                  role="tab"
                  aria-selected={r.index === current.index}
                  className={`tab${r.index === current.index ? ' on' : ''}`}
                  onClick={() => setRange(r.index)}
                >
                  {r.from}–{r.to}
                  {/* 읽을 차례인 편이 있는 구간 표시 */}
                  {turn !== 'restart' && Math.floor(nextIndex / RANGE_SIZE) === r.index && (
                    <span className="range-mark" aria-label="읽을 차례" />
                  )}
                </button>
              ))}
            </div>
          )}
          {/* 편 목록: 가는 선으로 나눈 리스트. 모든 줄이 같은 칸(아이콘·이름·막대·상태)을 나눠 써서 막대가 한 줄로 맞는다. */}
          <ol className={`timeline${editing ? ' editing' : ''}`} ref={listRef}>
            {visible.map((e) => {
              const status = statuses[episodes.indexOf(e)]
              // 전부 다 읽었으면 강조할 편이 없다
              const isNext = turn !== 'restart' && e.id === next.id
              const state = status.finished ? ' done' : status.started ? ' reading' : ''
              return (
                <li key={e.id} className={`tl-item${state}${isNext ? ' next' : ''}`}>
                  <button className="tl-body" onClick={() => onOpenEpisode(e)}>
                    <span className="tl-icon">
                      {status.finished ? <DoneIcon /> : status.started ? <ReadingIcon /> : <UnreadIcon />}
                    </span>
                    <span className="tl-title">{e.title}</span>
                    <span className="bar">
                      <span style={{ width: `${status.percent}%` }} />
                    </span>
                    <span className="tl-state">
                      {isNext && <span className="tl-badge">{TURN_BADGE[turn]}</span>}
                      {status.label}
                    </span>
                  </button>
                  {editing && (
                    <button className="icon-btn small" onClick={() => onDeleteEpisode(e)} title="이 편 삭제">
                      <TrashIcon />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}
