export interface Match {
  line: number
  start: number
  end: number
}

export const MATCH_LIMIT = 10000

/** 줄 단위로 검색하고, fromLine(0부터) 이후 첫 결과의 인덱스를 start로 함께 돌려준다. */
export function findMatches(lines: string[], query: string, caseSensitive: boolean, fromLine: number) {
  const matches: Match[] = []
  let capped = false

  if (query) {
    const q = caseSensitive ? query : query.toLowerCase()
    outer: for (let i = 0; i < lines.length; i++) {
      const s = caseSensitive ? lines[i] : lines[i].toLowerCase()
      let p = s.indexOf(q)
      while (p !== -1) {
        if (matches.length >= MATCH_LIMIT) {
          capped = true
          break outer
        }
        matches.push({ line: i, start: p, end: p + q.length })
        p = s.indexOf(q, p + q.length)
      }
    }
  }

  const start = matches.findIndex((m) => m.line >= fromLine)
  return { matches, capped, start: start === -1 ? 0 : start }
}
