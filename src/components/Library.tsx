import { useMemo, useState, type CSSProperties } from 'react'
import { lastReadAt, workProgress, type WorkSummary } from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover, workHue } from './Cover'
import { CheckIcon, EditDoneIcon, EditIcon, MoreIcon, PlusIcon, RecentDotIcon, TrashIcon } from './Icons'
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
  /** 고른 작품들을 지운다. 지웠으면 true */
  onDeleteWorks: (works: WorkSummary[]) => Promise<boolean>
}

export function Library({ items, positions, onOpen, onDetail, onAdd, onDeleteWorks }: LibraryProps) {
  const [filter, setFilter] = useState<Filter>('all')
  // 편집 중이면 표지를 눌러 여러 작품을 고르고 한 번에 지운다
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const stopEditing = () => {
    setEditing(false)
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  const allSelected = visible.length > 0 && visible.every(({ summary }) => selected.has(summary.work.id))

  const removeSelected = async () => {
    const works = items.filter((s) => selected.has(s.work.id))
    if (works.length && (await onDeleteWorks(works))) stopEditing()
  }

  return (
    <>
      <div className={`page-scroll${editing ? ' editing' : ''}`}>
        <div className="page library">
          <header className="page-head">
            <span className="eyebrow">LIBRARY</span>
            <h1 className="display">내 서재</h1>
            <p>{items.length ? `${items.length}개의 작품` : '아직 담은 작품이 없어요'}</p>
            {/* 작품 화면의 편집 버튼과 같은 모양·자리: 연필, 편집 중이면 짙은 원에 체크 */}
            {items.length > 0 && (
              <button
                className={`round-btn hero-edit${editing ? ' dark' : ''}`}
                onClick={() => (editing ? stopEditing() : setEditing(true))}
                title={editing ? '편집 끝내기' : '편집'}
                aria-pressed={editing}
              >
                {editing ? <EditDoneIcon /> : <EditIcon />}
              </button>
            )}
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
                    const checked = selected.has(s.work.id)
                    return (
                      <li
                        key={s.work.id}
                        className={`book${editing ? ' selecting' : ''}${checked ? ' checked' : ''}`}
                        style={{ '--h': workHue(s.work) } as CSSProperties}
                      >
                        <button
                          className="book-cover"
                          onClick={() => (editing ? toggle(s.work.id) : onOpen(s))}
                          aria-label={editing ? `${s.work.title} ${checked ? '선택 해제' : '선택'}` : `${s.work.title} 열기`}
                          aria-pressed={editing ? checked : undefined}
                        >
                          <span className="book-stage" />
                          <Cover title={s.work.title} image={s.work.cover} />
                          {count > 1 && <span className="badge">{count}편</span>}
                          {editing && (
                            <span className="book-check" aria-hidden>
                              {checked && <CheckIcon />}
                            </span>
                          )}
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
                          {!editing && (
                            <button className="icon-btn small" onClick={() => onDetail(s)} title="작품 정보">
                              <MoreIcon />
                            </button>
                          )}
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
      {editing ? (
        // 편집 중: 아래에 고르기·지우기 막대
        <div className="select-bar">
          <button
            className="pill"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(visible.map(({ summary }) => summary.work.id)))
            }
          >
            {allSelected ? '선택 해제' : '전체 선택'}
          </button>
          <button className="pill with-icon danger-fill" disabled={!selected.size} onClick={removeSelected}>
            <TrashIcon />
            {selected.size ? `${selected.size}개 삭제` : '삭제'}
          </button>
        </div>
      ) : (
        // 작품 담기: 오른쪽 아래에 떠 있는 버튼
        <button className="round-btn dark fab" onClick={onAdd} title="작품 담기">
          <PlusIcon size={22} />
        </button>
      )}
    </>
  )
}
