import type { CSSProperties } from 'react'
import { useObjectUrl } from '../lib/hooks'

/** 제목마다 늘 같은 색이 나오도록 제목에서 색상값을 만든다 */
export function hueOf(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 360
  return h
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
