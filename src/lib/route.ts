// 화면 주소 — GitHub Pages에서 새로고침해도 깨지지 않도록 # 뒤에 둔다.
//   #/                     처음 화면
//   #/library              내 서재
//   #/library/<작품 id>     작품
//   …/read                 위 화면에서 글을 여는 중 (폰의 뒤로 가기로 글을 닫을 수 있도록)

/** 글을 열지 않았을 때 보이는 화면. 글을 닫으면 이 화면으로 돌아온다. */
export type View = { name: 'home' } | { name: 'library' } | { name: 'work'; workId: string }

export interface Route {
  view: View
  reading: boolean
}

export const HOME: View = { name: 'home' }

export function parseRoute(hash = location.hash): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const reading = parts[parts.length - 1] === 'read'
  if (reading) parts.pop()
  if (parts[0] === 'library') {
    return { view: parts[1] ? { name: 'work', workId: decodeURIComponent(parts[1]) } : { name: 'library' }, reading }
  }
  return { view: HOME, reading }
}

export function routeHash({ view, reading }: Route) {
  const base =
    view.name === 'library' ? '#/library' : view.name === 'work' ? `#/library/${encodeURIComponent(view.workId)}` : '#'
  if (!reading) return base === '#' ? '#/' : base
  return base === '#' ? '#/read' : `${base}/read`
}

/** 이 앱 안에서 몇 번 화면을 넘어왔는지 — 0이면 뒤로 가기를 해도 앱 밖으로 나가므로 한 단계 위 화면으로 바꿔 넣는다 */
export function historyDepth(): number {
  return (history.state as { depth?: number } | null)?.depth ?? 0
}

export function pushRoute(route: Route) {
  history.pushState({ depth: historyDepth() + 1 }, '', routeHash(route))
}

export function replaceRoute(route: Route) {
  history.replaceState({ depth: historyDepth() }, '', routeHash(route))
}
