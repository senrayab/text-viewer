import type { CSSProperties } from 'react'
import { useObjectUrl } from '../lib/hooks'
import type { Work } from '../lib/library'

/** 제목마다 늘 같은 색이 나오도록 제목에서 색상값을 만든다 */
export function hueOf(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 3600
  // 황금각만큼 돌려서 비슷한 제목도 서로 다른 색이 나오게 한다
  return Math.round((h * 137.508) % 360)
}

/** 작품의 색 — 표지 이미지가 있으면 그 대표 색, 없으면 제목에서 만든 색 */
export function workHue(work: Work) {
  return work.coverHue ?? hueOf(work.title)
}

interface CoverProps {
  title: string
  image?: Blob
  size?: 'md' | 'sm'
}

/** 등록한 이미지가 없으면 제목과 은은한 색으로 표지를 그린다 */
export function Cover({ title, image, size = 'md' }: CoverProps) {
  const url = useObjectUrl(image)
  const style = (url ? { backgroundImage: `url(${url})` } : { '--h': hueOf(title) }) as CSSProperties

  return (
    <div className={`cover ${size}${url ? ' image' : ''}`} style={style}>
      {!url && <span className="cover-title">{title}</span>}
    </div>
  )
}
