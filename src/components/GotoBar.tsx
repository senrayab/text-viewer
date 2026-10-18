import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './Icons'

interface GotoBarProps {
  total: number
  onGo: (line: number) => void
  onClose: () => void
}

export function GotoBar({ total, onGo, onClose }: GotoBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  return (
    <div className="floating">
      <input
        ref={inputRef}
        value={value}
        inputMode="numeric"
        placeholder={`줄 번호로 이동 (1–${total.toLocaleString()})`}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value) onGo(Number(value))
        }}
      />
      <button className="icon-btn small" onClick={onClose} title="닫기 (Esc)">
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
