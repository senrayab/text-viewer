import { useMemo } from 'react'
import { FINISHED, episodeKey, episodeStatus, lastReadAt, type WorkSummary } from '../lib/library'
import type { Position } from '../lib/storage'
import { Cover } from './Cover'
import { MoreIcon, PlusIcon } from './Icons'
import { InstallHint } from './InstallHint'

interface LibraryProps {
  items: WorkSummary[]
  positions: Record<string, Position>
  onOpen: (summary: WorkSummary) => void
  onDetail: (summary: WorkSummary) => void
  onAdd: () => void
}

export function Library({ items, positions, onOpen, onDetail, onAdd }: LibraryProps) {
  // 최근에 읽었거나 담은 작품이 앞에 온다
  const sorted = useMemo(() => {
    const activity = (s: WorkSummary) => Math.max(lastReadAt(s, positions), s.work.updatedAt)
    return [...items].sort((a, b) => activity(b) - activity(a))
  }, [items, positions])

  return (
    <div className="page-scroll">
      <div className="page library">
        <header className="page-head">
          <div>
            <h1>내 서재</h1>
            <p>{items.length ? `${items.length}개의 작품` : '아직 담은 작품이 없어요'}</p>
          </div>
          <button className="primary with-icon" onClick={onAdd}>
            <PlusIcon />
            작품 담기
          </button>
        </header>

        <InstallHint />

        {items.length === 0 ? (
          <div className="lib-empty">
            txt 파일을 담아두면 언제든 여기서 꺼내 볼 수 있어요.
            <br />
            여러 편으로 된 글은 파일 이름으로 묶어드려요.
          </div>
        ) : (
          <ul className="shelf">
            {sorted.map((s) => {
              const count = s.episodes.length
              const read = s.episodes.filter((e) => (positions[episodeKey(e)]?.progress ?? 0) >= FINISHED).length
              const sub =
                count > 1
                  ? `${count}편 · ${read ? `${read}편 읽음` : '읽기 전'}`
                  : episodeStatus(positions[episodeKey(s.episodes[0])]).label
              return (
                <li key={s.work.id} className="book">
                  <button className="book-cover" onClick={() => onOpen(s)} aria-label={`${s.work.title} 열기`}>
                    <Cover title={s.work.title} image={s.work.cover} />
                    {count > 1 && <span className="badge">{count}편</span>}
                  </button>
                  <div className="book-meta">
                    <div className="book-text">
                      <div className="book-title">{s.work.title}</div>
                      <div className="book-sub">{sub}</div>
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
      </div>
    </div>
  )
}
