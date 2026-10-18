import { CloseIcon, DownIcon, UpIcon } from './Icons'

interface SearchBarProps {
  query: string
  onQuery: (q: string) => void
  caseSensitive: boolean
  onToggleCase: () => void
  count: number
  capped: boolean
  active: number
  pending: boolean
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

export function SearchBar(props: SearchBarProps) {
  const { query, count, capped, active, pending } = props

  let status = ''
  if (query && !pending) status = count ? `${active + 1} / ${count}${capped ? '+' : ''}` : '결과 없음'

  return (
    <div className="floating" role="search">
      <input
        id="search-input"
        value={query}
        placeholder="검색"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => props.onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (e.shiftKey) props.onPrev()
          else props.onNext()
        }}
      />
      <span className="count">{status}</span>
      <button
        className={`icon-btn small text${props.caseSensitive ? ' on' : ''}`}
        onClick={props.onToggleCase}
        title="대소문자 구분"
      >
        Aa
      </button>
      <button className="icon-btn small" onClick={props.onPrev} disabled={!count} title="이전 (Shift+Enter)">
        <UpIcon />
      </button>
      <button className="icon-btn small" onClick={props.onNext} disabled={!count} title="다음 (Enter)">
        <DownIcon />
      </button>
      <button className="icon-btn small" onClick={props.onClose} title="닫기 (Esc)">
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
