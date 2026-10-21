import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { lastReadAt, workProgress, type WorkSummary } from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover, workHue } from './Cover'
import {
  CheckIcon,
  ChevronIcon,
  EditDoneIcon,
  EditIcon,
  MoreIcon,
  PlusIcon,
  RecentIcon,
  TrashIcon,
} from './Icons'
import { InstallHint } from './InstallHint'

type Filter = 'all' | 'reading' | 'unread' | 'done'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'reading', label: '읽는 중' },
  { value: 'unread', label: '읽기 전' },
  { value: 'done', label: '다 읽음' },
]

// ── 가나다순과 오른쪽 레일 ──
// 레일 칸: ㄱ~ㅎ, 영문(A), 그 밖의 글자·숫자(#). 서재도 이 순서로 놓는다.
const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'A', '#']
// 첫소리 19개를 레일의 14칸으로 (된소리는 예사소리 칸에)
const JAMO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JAMO_TO_RAIL = 'ㄱㄱㄴㄷㄷㄹㅁㅂㅂㅅㅅㅇㅈㅈㅊㅋㅌㅍㅎ'
// 레일이 스크롤을 멈춘 뒤 이만큼 지나면 사라진다
const RAIL_HIDE_MS = 1200

/** 제목 첫 글자가 레일의 몇 번째 칸인지 */
function initialIndex(title: string) {
  const ch = title.trim().charAt(0)
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return INITIALS.indexOf(JAMO_TO_RAIL[Math.floor((code - 0xac00) / 588)])
  const jamo = JAMO.indexOf(ch)
  if (jamo >= 0) return INITIALS.indexOf(JAMO_TO_RAIL[jamo])
  if (/[a-z]/i.test(ch)) return INITIALS.indexOf('A')
  return INITIALS.length - 1
}

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

// 작품 화면에 들어갔다 돌아오면 보던 탭·스크롤 위치에서 다시 보여준다 (앱을 새로 열면 처음부터)
let lastFilter: Filter = 'all'
let lastScroll = 0

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
  const [filter, setFilterState] = useState<Filter>(lastFilter)
  const setFilter = (value: Filter) => {
    lastFilter = value
    setFilterState(value)
  }
  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = lastScroll
  }, [])
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

  // 가나다순 (ㄱ~ㅎ, 영문, 그 밖의 순서)
  const sorted = useMemo(
    () =>
      items
        .map((summary) => ({ summary, progress: workProgress(summary, positions), initial: initialIndex(summary.work.title) }))
        .sort((a, b) => a.initial - b.initial || collator.compare(a.summary.work.title, b.summary.work.title)),
    [items, positions],
  )

  // 가장 최근에 읽은 작품 — 위쪽 한 줄 알림으로 보여주고, 누르면 그 작품 자리로 간다
  const recentRead = useMemo(() => {
    let best: WorkSummary | undefined
    let at = 0
    for (const s of items) {
      const t = lastReadAt(s, positions)
      if (t > at) [best, at] = [s, t]
    }
    return best
  }, [items, positions])


  const visible = sorted.filter(({ progress }) => {
    if (filter === 'reading') return progress.started && !progress.done
    if (filter === 'unread') return !progress.started
    if (filter === 'done') return progress.done
    return true
  })

  // ── 작품 자리로 스크롤 ──
  const shelfRef = useRef<HTMLUListElement>(null)
  const scrollToBook = (id: string, smooth: boolean) => {
    const scroller = scrollRef.current
    const book = shelfRef.current?.querySelector(`[data-id="${id}"]`)
    if (!scroller || !book) return
    const top = book.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16
    scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
  }

  // 최근 읽은 글로: 지금 탭에서 안 보이면 "전체"로 바꾼 뒤 그 자리로 가서 잠깐 표시한다
  const [flashId, setFlashId] = useState<string>()
  const goRecent = () => {
    if (!recentRead) return
    if (!visible.some(({ summary }) => summary.work.id === recentRead.work.id)) setFilter('all')
    setFlashId(recentRead.work.id)
  }
  useEffect(() => {
    if (!flashId) return
    scrollToBook(flashId, true)
    const timer = setTimeout(() => setFlashId(undefined), 1600)
    return () => clearTimeout(timer)
  }, [flashId])

  // ── 오른쪽 가나다 레일: 스크롤할 때 나타났다가 멈추면 사라진다. 누르거나 끌면 그 글자의 첫 작품으로 ──
  const [railShown, setRailShown] = useState(false)
  const [bubble, setBubble] = useState<string>()
  const railRef = useRef<HTMLDivElement>(null)
  const railTimer = useRef(0)
  const scrubbing = useRef(false)
  const picked = useRef(-1)
  const showRail = () => {
    setRailShown(true)
    clearTimeout(railTimer.current)
    railTimer.current = window.setTimeout(() => !scrubbing.current && setRailShown(false), RAIL_HIDE_MS)
  }
  useEffect(() => () => clearTimeout(railTimer.current), [])

  const pickInitial = (clientY: number) => {
    const rail = railRef.current
    if (!rail) return
    const box = rail.getBoundingClientRect()
    const index = Math.min(INITIALS.length - 1, Math.max(0, Math.floor(((clientY - box.top) / box.height) * INITIALS.length)))
    if (index === picked.current) return
    picked.current = index
    setBubble(INITIALS[index])
    // 그 글자로 시작하는 작품이 없으면 다음 글자의 첫 작품으로
    const target = visible.find((v) => v.initial >= index) ?? visible[visible.length - 1]
    if (target) scrollToBook(target.summary.work.id, false)
  }
  const railDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    scrubbing.current = true
    picked.current = -1
    e.currentTarget.setPointerCapture(e.pointerId)
    pickInitial(e.clientY)
    showRail()
  }
  const railUp = () => {
    scrubbing.current = false
    setBubble(undefined)
    showRail()
  }

  const allSelected = visible.length > 0 && visible.every(({ summary }) => selected.has(summary.work.id))

  const removeSelected = async () => {
    const works = items.filter((s) => selected.has(s.work.id))
    if (works.length && (await onDeleteWorks(works))) stopEditing()
  }

  return (
    <>
      <div
        ref={scrollRef}
        className={`page-scroll${editing ? ' editing' : ''}`}
        onScroll={(e) => {
          lastScroll = e.currentTarget.scrollTop
          showRail()
        }}
      >
        <div className="page library">
          {/* 작품 화면의 편집 버튼과 같은 모양·자리, 스크롤해도 떠 있다: 연필, 편집 중이면 짙은 원에 체크 */}
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
          <header className="page-head">
            <span className="eyebrow">LIBRARY</span>
            <h1 className="display">내 서재</h1>
            <p>{items.length ? `${items.length}개의 작품` : '아직 담은 작품이 없어요'}</p>
          </header>

          {recentRead && (
            <button className="recent-bar" onClick={goRecent}>
              <span className="recent-bar-icon">
                <RecentIcon />
              </span>
              <span className="recent-bar-label">최근 읽은 글</span>
              <span className="recent-bar-title">{recentRead.work.title}</span>
              <ChevronIcon />
            </button>
          )}

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
                <ul className="shelf" ref={shelfRef}>
                  {visible.map(({ summary: s, progress }) => {
                    const count = s.episodes.length
                    const percent = progress.done ? 100 : progress.percent
                    const checked = selected.has(s.work.id)
                    return (
                      <li
                        key={s.work.id}
                        data-id={s.work.id}
                        className={`book${editing ? ' selecting' : ''}${checked ? ' checked' : ''}${flashId === s.work.id ? ' flash' : ''}`}
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
      {visible.length > 0 && (
        <div
          ref={railRef}
          className={`index-rail${railShown ? ' shown' : ''}`}
          onPointerDown={railDown}
          onPointerMove={(e) => scrubbing.current && pickInitial(e.clientY)}
          onPointerUp={railUp}
          onPointerCancel={railUp}
          aria-hidden
        >
          {INITIALS.map((ch) => (
            <span key={ch}>{ch}</span>
          ))}
        </div>
      )}
      {bubble && <div className="index-bubble">{bubble}</div>}
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
