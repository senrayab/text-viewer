import { useMemo, useState, type CSSProperties } from 'react'
import { lastReadAt, workProgress, type WorkSummary } from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover, workHue } from './Cover'
import { MoreIcon, PlusIcon, RecentDotIcon } from './Icons'
import { InstallHint } from './InstallHint'

type Filter = 'all' | 'reading' | 'unread' | 'done'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'reading', label: '읽는 중' },
  { value: 'unread', label: '읽기 전' },
  { value: 'done', label: '다 읽음' },
]

interface LibraryProps {
  items: WorkSummary[]
  positions: Record<string, Position>
  onOpen: (summary: WorkSummary) => void
  onDetail: (summary: WorkSummary) => void
  onAdd: () => void
}

export function Library({ items, positions, onOpen, onDetail, onAdd }: LibraryProps) {
  const [filter, setFilter] = useState<Filter>('all')

  // 최근에 읽었거나 담은 작품이 앞에 온다
  const sorted = useMemo(() => {
    const activity = (s: WorkSummary) => Math.max(lastReadAt(s, positions), s.work.updatedAt)
    return [...items]
      .sort((a, b) => activity(b) - activity(a))
      .map((summary) => ({ summary, progress: workProgress(summary, positions) }))
  }, [items, positions])

  // 가장 최근에 읽다 만 작품 — 제목 앞에 점으로 표시한다
  const recentId = useMemo(() => {
    const reading = sorted.filter(({ progress }) => progress.started && !progress.done)
    if (!reading.length) return undefined
    return reading.reduce((a, b) => (lastReadAt(b.summary, positions) > lastReadAt(a.summary, positions) ? b : a))
      .summary.work.id
  }, [sorted, positions])

  const visible = sorted.filter(({ progress }) => {
    if (filter === 'reading') return progress.started && !progress.done
    if (filter === 'unread') return !progress.started
    if (filter === 'done') return progress.done
    return true
  })

  return (
    <>
      <div className="page-scroll">
        <div className="page library">
          <header className="page-head">
            <span className="eyebrow">LIBRARY</span>
            <h1 className="display">내 서재</h1>
            <p>{items.length ? `${items.length}개의 작품` : '아직 담은 작품이 없어요'}</p>
          </header>

          <InstallHint />

          {items.length === 0 ? (
            <div className="lib-empty">
              <p>
                txt 파일을 담아두면 언제든 여기서 꺼내 볼 수 있어요.
                <br />
                여러 편으로 된 글은 파일 이름으로 묶어드려요.
              </p>
              <button className="pill dark" onClick={onAdd}>
                첫 작품 담기
              </button>
            </div>
          ) : (
            <>
              <div className="tabs" role="tablist">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    role="tab"
                    aria-selected={filter === f.value}
                    className={`tab${filter === f.value ? ' on' : ''}`}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <p className="lib-none">이 조건에 맞는 작품이 없어요.</p>
              ) : (
                <ul className="shelf">
                  {visible.map(({ summary: s, progress }) => {
                    const count = s.episodes.length
                    const percent = progress.done ? 100 : progress.percent
                    return (
                      <li key={s.work.id} className="book" style={{ '--h': workHue(s.work) } as CSSProperties}>
                        <button className="book-cover" onClick={() => onOpen(s)} aria-label={`${s.work.title} 열기`}>
                          <span className="book-stage" />
                          <Cover title={s.work.title} image={s.work.cover} />
                          {count > 1 && <span className="badge">{count}편</span>}
                        </button>
                        <div className="book-meta">
                          <div className="book-text">
                            <div className="book-title">
                              {s.work.id === recentId && (
                                <span className="recent-dot" title="최근에 읽은 작품">
                                  <RecentDotIcon />
                                </span>
                              )}
                              <span>{s.work.title}</span>
                            </div>
                            {/* 편수는 표지의 배지에 있으니, 여기는 읽은 정도만 한 줄로 (읽기 전이면 0%) */}
                            <div className="book-progress">
                              <span className="bar">
                                <span style={{ width: `${percent}%` }} />
                              </span>
                              <span className="book-pct">{percent}%</span>
                            </div>
                          </div>
                          <button className="icon-btn small" onClick={() => onDetail(s)} title="작품 정보">
                            <MoreIcon />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      {/* 작품 담기: 오른쪽 아래에 떠 있는 버튼 */}
      <button className="round-btn dark fab" onClick={onAdd} title="작품 담기">
        <PlusIcon size={22} />
      </button>
    </>
  )
}
