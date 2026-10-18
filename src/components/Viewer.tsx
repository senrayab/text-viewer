import { memo, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { FONTS, WIDTHS, type Settings } from '../settings'

/** [시작, 끝, 전체 검색 결과에서의 인덱스] */
export type MatchRange = [number, number, number]

interface LineProps {
  n: number
  text: string
  ranges?: MatchRange[]
  active: number
}

const Line = memo(function Line({ n, text, ranges, active }: LineProps) {
  let body: ReactNode = text
  if (ranges) {
    const parts: ReactNode[] = []
    let pos = 0
    for (const [start, end, index] of ranges) {
      if (start > pos) parts.push(text.slice(pos, start))
      parts.push(
        <mark key={index} data-m={index} className={index === active ? 'active' : undefined}>
          {text.slice(start, end)}
        </mark>,
      )
      pos = end
    }
    if (pos < text.length) parts.push(text.slice(pos))
    body = parts
  }

  return (
    <div className="line" data-line={n}>
      <span className="ln">{n}</span>
      <span className="lt">{body}</span>
    </div>
  )
})

interface ViewerProps {
  lines: string[]
  matchesByLine: Map<number, MatchRange[]>
  activeMatch: number
  activeLine: number
  settings: Settings
  scrollerRef: RefObject<HTMLDivElement>
  contentRef: RefObject<HTMLDivElement>
  onScroll: () => void
}

export const Viewer = memo(function Viewer({
  lines,
  matchesByLine,
  activeMatch,
  activeLine,
  settings,
  scrollerRef,
  contentRef,
  onScroll,
}: ViewerProps) {
  const style = {
    '--fs': `${settings.fontSize}px`,
    '--lh': settings.lineHeight,
    '--maxw': WIDTHS.find((w) => w.value === settings.width)!.css,
    '--font': FONTS.find((f) => f.value === settings.font)!.stack,
    '--ln-w': `${String(lines.length).length + 1}ch`,
  } as CSSProperties

  const className = ['content', settings.wrap ? 'wrap' : 'nowrap', settings.lineNumbers && 'show-ln']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="reader" ref={scrollerRef} onScroll={onScroll} style={style} tabIndex={0}>
      <div className={className} ref={contentRef}>
        {lines.map((text, i) => (
          <Line
            key={i}
            n={i + 1}
            text={text}
            ranges={matchesByLine.get(i)}
            active={i === activeLine ? activeMatch : -1}
          />
        ))}
      </div>
    </div>
  )
})
