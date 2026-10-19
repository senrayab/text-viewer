import { useEffect, useState, type CSSProperties } from 'react'
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
  BookIcon,
  CoverIcon,
  CoverRemoveIcon,
  DoneIcon,
  EditIcon,
  PlusIcon,
  ReadingIcon,
  SortIcon,
  TrashIcon,
  UnreadIcon,
} from './Icons'

type EpisodeOrder = 'first' | 'latest'

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

  const ctaLabel = { start: '읽기 시작', continue: '이어 읽기', next: '다음 편 읽기', restart: '처음부터 다시 읽기' }[turn]

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
              <h1>{work.title}</h1>
            )}
            <div className="stats">
              <span className="stat">
                <b>{episodes.length}</b>편
              </span>
              <span className="stat">
                <b>{progress.done ? 100 : progress.percent}</b>% 읽음
              </span>
              {episodes.length > 1 && (
                <span className="stat">
                  <b>{episodes.length - progress.finished}</b>편 남음
                </span>
              )}
            </div>
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
          <div className="card actions-card">
            <label className="row action">
              <span className="row-label">
                <span className="chip chip-lavender">
                  <CoverIcon />
                </span>
                표지 이미지 {work.cover ? '바꾸기' : '등록'}
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
              <button className="row action" onClick={() => onCover(null)}>
                <span className="row-label">
                  <span className="chip chip-stone">
                    <CoverRemoveIcon />
                  </span>
                  표지 이미지 지우기
                </span>
              </button>
            )}
            <button className="row action" onClick={onAddEpisodes}>
              <span className="row-label">
                <span className="chip chip-sage">
                  <PlusIcon />
                </span>
                편 추가하기
              </span>
            </button>
            <button className="row action danger" onClick={onDeleteWork}>
              <span className="row-label">
                <span className="chip chip-peach">
                  <TrashIcon />
                </span>
                작품 삭제
              </span>
            </button>
          </div>
        )}

        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <h3>
                목록 <span className="count">{episodes.length}</span>
              </h3>
              {episodes.length > 1 && (
                <button className="sort-btn" onClick={toggleOrder} title="정렬 순서 바꾸기">
                  <SortIcon />
                  {order === 'first' ? '1편부터' : '최신순'}
                </button>
              )}
            </div>
            <button className="pill small with-icon work-cta" onClick={() => onOpenEpisode(next)}>
              <BookIcon size={14} />
              {ctaLabel}
              {episodes.length > 1 && ` · ${next.title}`}
            </button>
          </div>
          {/* 편마다 상태 아이콘을 세로선으로 이은 타임라인. 줄 전체를 누르면 열리고, 읽을 차례인 편은 줄 배경으로 강조한다. */}
          <ol className="timeline">
            {(order === 'first' ? episodes : [...episodes].reverse()).map((e) => {
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
                    <span className="tl-state">{status.label}</span>
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
