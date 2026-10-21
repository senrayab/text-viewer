import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { PRIVACY_URL, TERMS_URL } from '../config'
import { connectedAccount, driveConfigured, preloadGoogle } from '../lib/drive'
import { COVERS, FONT_SIZE, FONTS, LINE_HEIGHT, THEMES, WIDTHS, clamp, type Settings } from '../settings'
import {
  ChevronIcon,
  CloseIcon,
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
  /** 닫히는 중이면 아래로 내려가며 사라진다 */
  leaving?: boolean
  /** 백업 화면으로 넘어갈 때, 돌아올 자리를 위해 지금 스크롤 위치를 넘긴다 */
  onOpenBackup: (scrollTop: number) => void
  /** 백업 화면에서 돌아올 때 보여줄 스크롤 위치 */
  initialScrollTop?: number
}

/** 섹션: 작은 대문자 이름 아래 내용 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opt-section">
      <h3 className="section-label">{title}</h3>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  /** lead: 글자 앞에 붙는 작은 표시(테마 색 등), style: 글자 모양(폰트 등) */
  options: { value: T; label: string; lead?: ReactNode; style?: CSSProperties }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.lead}
          <span style={o.style}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** 항목 왼쪽: 흐린 아이콘 + 제목과 그 아래 한 줄 설명 */
function OptText({ icon, label, desc, hint }: { icon?: ReactNode; label: string; desc?: string; hint?: string }) {
  return (
    <span className="opt-main">
      {icon && <span className="opt-icon">{icon}</span>}
      <span className="opt-text">
        <span className="opt-title">
          {label}
          {hint && <kbd>{hint}</kbd>}
        </span>
        {desc && <span className="opt-desc">{desc}</span>}
      </span>
    </span>
  )
}

function Stepper({
  icon,
  label,
  desc,
  value,
  display,
  range,
  onChange,
}: {
  icon?: ReactNode
  label: string
  desc?: string
  value: number
  display: string
  range: { min: number; max: number; step: number }
  onChange: (v: number) => void
}) {
  const step = (dir: number) => onChange(clamp(Math.round((value + dir * range.step) * 10) / 10, range.min, range.max))
  return (
    <div className="opt">
      <OptText icon={icon} label={label} desc={desc} />
      <div className="stepper">
        <button className="icon-btn small" onClick={() => step(-1)} disabled={value <= range.min} title="줄이기">
          <MinusIcon />
        </button>
        <span className="value">{display}</span>
        <button className="icon-btn small" onClick={() => step(1)} disabled={value >= range.max} title="늘리기">
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

function Toggle({
  icon,
  label,
  desc,
  hint,
  checked,
  onChange,
}: {
  icon?: ReactNode
  label: string
  desc?: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="opt">
      <OptText icon={icon} label={label} desc={desc} hint={hint} />
      <button
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </label>
  )
}

export function SettingsPanel({ settings, onChange, onClose, leaving, onOpenBackup, initialScrollTop }: SettingsPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const initialScroll = useRef(initialScrollTop ?? readScroll())

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
    // 백업 화면 바깥을 눌러 닫으면 그 누름으로 이 패널이 다시 열리는데, 같은 누름을 "패널 바깥 누름"으로 보고
    // 바로 닫지 않도록 열린 뒤에 시작된 누름만 본다
    const openedAt = performance.now()
    const onDown = (e: MouseEvent) => {
      if (e.timeStamp < openedAt) return
      const target = e.target as HTMLElement
      if (ref.current?.contains(target) || target.closest('[data-settings-toggle]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const fontStack = FONTS.find((f) => f.value === settings.font)!.stack

  return (
    <div className={`panel${leaving ? " leaving" : ""}`} ref={ref} onScroll={(e) => rememberScroll(e.currentTarget.scrollTop)}>
      <header className="sheet-head">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <p>편하게 읽을 수 있도록 맞춰보세요.</p>
        </div>
        <button className="round-btn sheet-close" onClick={onClose} title="닫기">
          <CloseIcon />
        </button>
      </header>

      {/* 지금 설정으로 본문이 어떻게 보이는지 */}
      <div className="preview">
        <span className="preview-label">미리보기</span>
        <p style={{ fontFamily: fontStack, fontSize: settings.fontSize, lineHeight: settings.lineHeight }}>
          한 줄씩, 편안하게 읽어보세요.
        </p>
      </div>

      <Section title="Theme">
        <Segmented
          options={THEMES.map((t) => ({ ...t, lead: <span className={`theme-dot theme-dot-${t.value}`} /> }))}
          value={settings.theme}
          onChange={(v) => onChange('theme', v)}
        />
      </Section>

      {/* 이미지를 등록한 표지는 어느 쪽이든 그 이미지로 보인다 */}
      <Section title="Cover">
        <Segmented
          options={COVERS.map((c) => ({ ...c, lead: <span className={`theme-dot cover-dot-${c.value}`} /> }))}
          value={settings.cover}
          onChange={(v) => onChange('cover', v)}
        />
      </Section>

      <Section title="Font">
        {/* 이름을 각 글꼴로 써서 고르기 전에 모양을 볼 수 있게 한다 */}
        <Segmented
          options={FONTS.map((f) => ({ ...f, style: { fontFamily: f.stack } }))}
          value={settings.font}
          onChange={(v) => onChange('font', v)}
        />
      </Section>

      <Section title="Width">
        <Segmented options={WIDTHS} value={settings.width} onChange={(v) => onChange('width', v)} />
      </Section>

      <Section title="Reading">
        <div className="opt-list">
          <Stepper
            icon={<FontSizeIcon size={18} />}
            label="글자 크기"
            desc="본문 글자를 키우거나 줄여요"
            value={settings.fontSize}
            display={`${settings.fontSize}px`}
            range={FONT_SIZE}
            onChange={(v) => onChange('fontSize', v)}
          />
          <Stepper
            icon={<LineHeightIcon size={18} />}
            label="줄 간격"
            desc="줄 사이 여백을 넓히거나 좁혀요"
            value={settings.lineHeight}
            display={settings.lineHeight.toFixed(1)}
            range={LINE_HEIGHT}
            onChange={(v) => onChange('lineHeight', v)}
          />
          <Toggle
            icon={<LineNumberIcon size={18} />}
            label="줄 번호"
            desc="줄 앞에 번호를 붙여요"
            hint="L"
            checked={settings.lineNumbers}
            onChange={(v) => onChange('lineNumbers', v)}
          />
          <Toggle
            icon={<WrapIcon size={18} />}
            label="자동 줄바꿈"
            desc="긴 줄을 화면 폭에 맞춰 접어요"
            hint="W"
            checked={settings.wrap}
            onChange={(v) => onChange('wrap', v)}
          />
        </div>
      </Section>

      <Section title="Data">
        <div className="opt-list">
          <Toggle
            icon={<RecentIcon size={18} />}
            label="최근 문서 기억"
            desc="처음 화면에서 마지막 문서를 다시 열 수 있어요"
            checked={settings.rememberRecent}
            onChange={(v) => onChange('rememberRecent', v)}
          />
          <button className="opt opt-link" onClick={() => onOpenBackup(ref.current?.scrollTop ?? 0)}>
            <OptText icon={<CloudIcon size={18} />} label="구글 드라이브 백업" desc="서재를 드라이브에 보관하고 불러와요" />
            <span className="row-chevron">
              <ChevronIcon />
            </span>
          </button>
        </div>
      </Section>

      <p className="panel-foot">
        <a href={TERMS_URL}>이용약관</a>
        <span aria-hidden>·</span>
        <a href={PRIVACY_URL}>개인정보처리방침</a>
      </p>
    </div>
  )
}
