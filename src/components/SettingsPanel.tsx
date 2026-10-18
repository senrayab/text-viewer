import { useEffect, useRef } from 'react'
import { FONT_SIZE, FONTS, LINE_HEIGHT, THEMES, WIDTHS, clamp, type Settings } from '../settings'
import { MinusIcon, PlusIcon } from './Icons'

interface SettingsPanelProps {
  settings: Settings
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  onClose: () => void
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  label,
  value,
  display,
  range,
  onChange,
}: {
  label: string
  value: number
  display: string
  range: { min: number; max: number; step: number }
  onChange: (v: number) => void
}) {
  const step = (dir: number) => onChange(clamp(Math.round((value + dir * range.step) * 10) / 10, range.min, range.max))
  return (
    <div className="row">
      <span>{label}</span>
      <div className="stepper">
        <button className="icon-btn small" onClick={() => step(-1)} disabled={value <= range.min}>
          <MinusIcon />
        </button>
        <span className="value">{display}</span>
        <button className="icon-btn small" onClick={() => step(1)} disabled={value >= range.max}>
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row">
      <span>
        {label} <kbd>{hint}</kbd>
      </span>
      <button
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </label>
  )
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (ref.current?.contains(target) || target.closest('[data-settings-toggle]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="panel" ref={ref}>
      <div className="field">
        <div className="label">테마</div>
        <div className="swatches">
          {THEMES.map((t) => (
            <button
              key={t.value}
              className={t.value === settings.theme ? 'on' : undefined}
              onClick={() => onChange('theme', t.value)}
            >
              <span className={`sw sw-${t.value}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="label">글꼴</div>
        <Segmented options={FONTS} value={settings.font} onChange={(v) => onChange('font', v)} />
      </div>

      <div className="field">
        <div className="label">본문 폭</div>
        <Segmented options={WIDTHS} value={settings.width} onChange={(v) => onChange('width', v)} />
      </div>

      <div className="field rows">
        <Stepper
          label="글자 크기"
          value={settings.fontSize}
          display={`${settings.fontSize}px`}
          range={FONT_SIZE}
          onChange={(v) => onChange('fontSize', v)}
        />
        <Stepper
          label="줄 간격"
          value={settings.lineHeight}
          display={settings.lineHeight.toFixed(1)}
          range={LINE_HEIGHT}
          onChange={(v) => onChange('lineHeight', v)}
        />
        <Toggle label="줄 번호" hint="L" checked={settings.lineNumbers} onChange={(v) => onChange('lineNumbers', v)} />
        <Toggle label="자동 줄바꿈" hint="W" checked={settings.wrap} onChange={(v) => onChange('wrap', v)} />
      </div>
    </div>
  )
}
