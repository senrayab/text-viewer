import type { ReactNode } from 'react'
import { CloseIcon } from './Icons'

export interface ReaderMenuItem {
  icon: ReactNode
  label: string
  /** 키보드 단축키 안내 (PC) */
  hint?: string
  onSelect: () => void
}

interface ReaderMenuProps {
  items: ReaderMenuItem[]
  onClose: () => void
}

/** 휴대폰 읽기 화면의 ⋯ 메뉴 — 머리에 다 넣기 어려운 버튼을 아래에서 올라오는 시트로 모아 둔다 */
export function ReaderMenu({ items, onClose }: ReaderMenuProps) {
  return (
    <>
      <div className="sheet-backdrop" onMouseDown={onClose} aria-hidden />
      <div className="panel menu-sheet" role="menu" aria-label="더보기">
        <header className="sheet-head">
          <span className="eyebrow">MENU</span>
          <button className="round-btn sheet-close" onClick={onClose} title="닫기">
            <CloseIcon />
          </button>
        </header>
        <div className="card">
          {items.map((item) => (
            <button
              key={item.label}
              className="row action"
              role="menuitem"
              onClick={() => {
                // 파일 열기 창은 누른 처리 안에서 바로 띄워야 하므로 닫기와 실행을 같은 처리에서 한다
                onClose()
                item.onSelect()
              }}
            >
              <span className="row-label">
                <span className="chip chip-stone">{item.icon}</span>
                {item.label}
              </span>
              {item.hint && <kbd>{item.hint}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
