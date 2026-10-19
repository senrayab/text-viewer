import { useEffect, useRef, type ReactNode } from 'react'
import { PRIVACY_URL } from '../config'
import { connectedAccount, driveConfigured, preloadGoogle } from '../lib/drive'
import { FONT_SIZE, FONTS, LINE_HEIGHT, THEMES, WIDTHS, clamp, type Settings } from '../settings'
import {
  ChevronIcon,
  CloudIcon,
  FontSizeIcon,
  LineHeightIcon,
  LineNumberIcon,
  MinusIcon,
  PlusIcon,
  RecentIcon,
  WrapIcon,
} from './Icons'

/** 패널 스크롤 위치 — 개인정보처리방침에 다녀오거나 새로고침해도 같은 자리를 보여준다 */
const SCROLL_KEY = 'text-viewer:panel-scroll'

function readScroll() {
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY)) || 0
  } catch {
    return 0
  }
}

function rememberScroll(top: number | null) {
  try {
    if (top === null) sessionStorage.removeItem(SCROLL_KEY)
    else sessionStorage.setItem(SCROLL_KEY, String(Math.round(top)))
  } catch {
    // 무시
  }
}

interface SettingsPanelProps {
  settings: Settings
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  onClose: () => void
  onOpenBackup: () => void
}

/** 항목 앞 아이콘 칩의 은은한 바탕색 */
type Tone = 'lavender' | 'sky' | 'sage' | 'peach' | 'stone'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  )
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

function RowLabel({ icon, tone, children }: { icon: ReactNode; tone: Tone; children: ReactNode }) {
  return (
    <span className="row-label">
      <span className={`chip chip-${tone}`}>{icon}</span>
      {children}
    </span>
  )
}

function Stepper({
  icon,
  tone,
  label,
  value,
  display,
  range,
  onChange,
}: {
  icon: ReactNode
  tone: Tone
  label: string
  value: number
  display: string
  range: { min: number; max: number; step: number }
  onChange: (v: number) => void
}) {
  const step = (dir: number) => onChange(clamp(Math.round((value + dir * range.step) * 10) / 10, range.min, range.max))
  return (
    <div className="row">
      <RowLabel icon={icon} tone={tone}>
        {label}
      </RowLabel>
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

function Toggle({
  icon,
  tone,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: ReactNode
  tone: Tone
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="row">
      <RowLabel icon={icon} tone={tone}>
        {label} {hint && <kbd>{hint}</kbd>}
      </RowLabel>
      <button
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </label>
  )
}

export function SettingsPanel({ settings, onChange, onClose, onOpenBackup }: SettingsPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const initialScroll = useRef(readScroll())

  // 구글 드라이브를 연결한 적이 있으면, 백업 화면을 누르는 순간 조용히 다시 연결할 수 있도록 미리 불러 둔다
  useEffect(() => {
    if (driveConfigured && connectedAccount() !== null) preloadGoogle().catch(() => {})
  }, [])

  // 열릴 때 지난 스크롤 위치로, 닫힐 때(페이지를 떠나는 것 말고 패널을 닫을 때) 기억을 지운다
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = initialScroll.current
    return () => rememberScroll(null)
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (ref.current?.contains(target) || target.closest('[data-settings-toggle]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const fontStack = FONTS.find((f) => f.value === settings.font)!.stack

  return (
    <div className="panel" ref={ref} onScroll={(e) => rememberScroll(e.currentTarget.scrollTop)}>
      <header className="panel-head">
        <h2>보기 설정</h2>
        <p>편하게 읽을 수 있도록 맞춰보세요</p>
      </header>

      {/* 지금 설정으로 본문이 어떻게 보이는지 */}
      <div className="preview">
        <span className="eyebrow">미리보기</span>
        <p style={{ fontFamily: fontStack, fontSize: settings.fontSize, lineHeight: settings.lineHeight }}>
          한 줄씩, 편안하게 읽어보세요.
        </p>
      </div>

      <Section title="테마">
        <div className="tiles four">
          {THEMES.map((t) => (
            <button
              key={t.value}
              className={`tile${t.value === settings.theme ? ' on' : ''}`}
              onClick={() => onChange('theme', t.value)}
            >
              <span className={`theme-page theme-page-${t.value}`}>가</span>
              <span className="tile-label">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="글꼴">
        <div className="tiles three">
          {FONTS.map((f) => (
            <button
              key={f.value}
              className={`tile${f.value === settings.font ? ' on' : ''}`}
              onClick={() => onChange('font', f.value)}
            >
              <span className="glyph" style={{ fontFamily: f.stack }}>
                가
              </span>
              <span className="tile-label">{f.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="본문 폭">
        <Segmented options={WIDTHS} value={settings.width} onChange={(v) => onChange('width', v)} />
      </Section>

      <Section title="읽기">
        <div className="card">
          <Stepper
            icon={<FontSizeIcon />}
            tone="lavender"
            label="글자 크기"
            value={settings.fontSize}
            display={`${settings.fontSize}px`}
            range={FONT_SIZE}
            onChange={(v) => onChange('fontSize', v)}
          />
          <Stepper
            icon={<LineHeightIcon />}
            tone="sky"
            label="줄 간격"
            value={settings.lineHeight}
            display={settings.lineHeight.toFixed(1)}
            range={LINE_HEIGHT}
            onChange={(v) => onChange('lineHeight', v)}
          />
          <Toggle
            icon={<LineNumberIcon />}
            tone="sage"
            label="줄 번호"
            hint="L"
            checked={settings.lineNumbers}
            onChange={(v) => onChange('lineNumbers', v)}
          />
          <Toggle
            icon={<WrapIcon />}
            tone="peach"
            label="자동 줄바꿈"
            hint="W"
            checked={settings.wrap}
            onChange={(v) => onChange('wrap', v)}
          />
        </div>
      </Section>

      <Section title="기록">
        <div className="card">
          <Toggle
            icon={<RecentIcon />}
            tone="stone"
            label="최근 문서 기억"
            checked={settings.rememberRecent}
            onChange={(v) => onChange('rememberRecent', v)}
          />
          <button className="row action" onClick={onOpenBackup}>
            <RowLabel icon={<CloudIcon />} tone="sky">
              구글 드라이브 백업
            </RowLabel>
            <span className="row-chevron">
              <ChevronIcon />
            </span>
          </button>
        </div>
      </Section>

      <a className="panel-foot" href={PRIVACY_URL}>
        개인정보처리방침
      </a>
    </div>
  )
}
