import { useEffect, useState, type CSSProperties } from 'react'
import {
  continueEpisode,
  episodeBadge,
  episodeKey,
  episodeStatus,
  type Episode,
  type WorkSummary,
} from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover, hueOf } from './Cover'
import { CoverIcon, CoverRemoveIcon, EditIcon, PlusIcon, TrashIcon } from './Icons'

/** 편 목록의 작은 표지 — 작품 표지와 같은 색으로 편 번호를 보여준다 */
function EpisodeThumb({ hue, number, unit }: { hue: number; number: string; unit: string }) {
  return (
    <span className="ep-thumb" style={{ '--h': hue } as CSSProperties}>
      <b>{number}</b>
      <small>{unit}</small>
    </span>
  )
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
  const [title, setTitle] = useState(work.title)
  useEffect(() => setTitle(work.title), [work.title])

  const statuses = episodes.map((e) => episodeStatus(positions[episodeKey(e)]))
  const hue = hueOf(work.title)
  const read = statuses.filter((s) => s.finished).length
  const next = continueEpisode(summary, positions)
  const started = !!positions[episodeKey(next)]

  const commitTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== work.title) onRename(trimmed)
    else setTitle(work.title)
  }

  return (
    <div className="page-scroll">
      <div className="page work">
        <header className="work-head">
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
            <p>
              {episodes.length}편{read ? ` · ${read}편 읽음` : ''}
            </p>
            <div className="work-actions">
              <button className="primary" onClick={() => onOpenEpisode(next)}>
                {started ? `이어 읽기 · ${next.title}` : '처음부터 읽기'}
              </button>
              <button
                className={`icon-btn${editing ? ' on' : ''}`}
                onClick={() => setEditing((v) => !v)}
                title={editing ? '편집 끝내기' : '편집'}
              >
                <EditIcon />
              </button>
            </div>
          </div>
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
          <h3>목록</h3>
          <ul className="card episodes">
            {episodes.map((e, i) => {
              const status = statuses[i]
              return (
                <li key={e.id} className="row">
                  <button className="ep" onClick={() => onOpenEpisode(e)}>
                    <EpisodeThumb hue={hue} {...episodeBadge(e, i)} />
                    <span className="ep-body">
                      <span className="ep-title">{e.title}</span>
                      <span className={`ep-progress${status.finished ? ' done' : ''}`}>
                        <span className="ep-state">{status.label}</span>
                        <span className="bar">
                          <span style={{ width: `${status.percent}%` }} />
                        </span>
                      </span>
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
          </ul>
        </section>
      </div>
    </div>
  )
}
