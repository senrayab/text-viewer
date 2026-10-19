import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from './components/EmptyState'
import { GotoBar } from './components/GotoBar'
import { BackIcon, CloseIcon, FocusIcon, OpenIcon, SearchIcon, TypeIcon } from './components/Icons'
import { SearchBar } from './components/SearchBar'
import { SettingsPanel } from './components/SettingsPanel'
import { Viewer, type MatchRange } from './components/Viewer'
import { ENCODINGS, decode, detectEncoding, type EncodingChoice } from './lib/decode'
import { formatBytes, useDebounced, useResolvedTheme, useUpdateAvailable } from './lib/hooks'
import { findMatches } from './lib/search'
import {
  clearEntry,
  isSessionOpen,
  loadEntry,
  reopenRecent,
  restoreRecent,
  saveEntry,
  setSessionOpen,
  type RecentEntry,
} from './lib/recent'
import { loadPosition, loadSettings, savePosition, saveSettings } from './lib/storage'
import { FONT_SIZE, THEMES, clamp, type Settings } from './settings'

interface Doc {
  key: string
  name: string
  size: number
  buffer: ArrayBuffer
  file: File
  handle?: FileSystemFileHandle
}

const ACCEPT = '.txt,.text,.log,text/plain'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])
  useEffect(() => saveSettings(settings), [settings])

  const theme = useResolvedTheme(settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // ── 문서 ──────────────────────────────────────────────
  const [doc, setDoc] = useState<Doc | null>(null)
  const [encodingChoice, setEncodingChoice] = useState<EncodingChoice>('auto')
  const [error, setError] = useState<string | null>(null)
  const detected = useMemo(() => (doc ? detectEncoding(doc.buffer) : 'utf-8'), [doc])
  const encoding = encodingChoice === 'auto' ? detected : encodingChoice
  const lines = useMemo(() => (doc ? decode(doc.buffer, encoding).split(/\r\n|\r|\n/) : []), [doc, encoding])
  const charCount = useMemo(() => lines.reduce((n, l) => n + l.length, 0), [lines])

  useEffect(() => {
    document.title = doc ? `${doc.name} — Text Viewer` : 'Text Viewer'
  }, [doc])

  // ── UI 상태 ───────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [gotoOpen, setGotoOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState<{ text: string; ms: number } | null>(null)
  const [recent, setRecent] = useState<RecentEntry>()
  const updateAvailable = useUpdateAvailable()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const topLineRef = useRef(1)
  const docKeyRef = useRef<string | null>(null)
  const saveTimer = useRef<number>()
  const scrollFrame = useRef(0)

  const showToast = useCallback((text: string, ms = 1800) => setToast({ text, ms }), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.ms)
    return () => clearTimeout(id)
  }, [toast])

  const openFile = useCallback(async (file: File, handle?: FileSystemFileHandle) => {
    try {
      const buffer = await file.arrayBuffer()
      setDoc({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        size: file.size,
        buffer,
        file,
        handle,
      })
      setEncodingChoice('auto')
      setError(null)
      setQuery('')
      setSearchOpen(false)
      setGotoOpen(false)
      setProgress(0)
      setSessionOpen(true)
    } catch {
      setError('파일을 읽을 수 없습니다.')
    }
  }, [])

  // 지금 보는 문서는 새로고침 복원용으로 항상 저장한다
  useEffect(() => {
    if (doc) saveEntry('session', doc.file, doc.buffer, doc.handle)
  }, [doc])

  // 최근 문서 기억이 켜져 있으면 지금 보는 문서를 저장하고, 꺼지면 저장해 둔 것을 지운다
  useEffect(() => {
    if (!settings.rememberRecent) {
      clearEntry('recent')
      setRecent(undefined)
      return
    }
    const saved = doc ? saveEntry('recent', doc.file, doc.buffer, doc.handle) : Promise.resolve()
    saved.then(() => loadEntry('recent')).then(setRecent)
  }, [doc, settings.rememberRecent])

  // 새로고침 전에 보던 문서가 있으면 다시 연다
  const [restoring, setRestoring] = useState(isSessionOpen)
  const restoreStarted = useRef(false)
  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true
    if (!isSessionOpen()) {
      clearEntry('session')
      return
    }
    loadEntry('session').then(async (entry) => {
      const restored = entry ? await restoreRecent(entry) : undefined
      if (restored) await openFile(restored.file, restored.handle)
      else setSessionOpen(false)
      setRestoring(false)
    })
  }, [openFile])

  const goHome = useCallback(() => {
    setDoc(null)
    setSessionOpen(false)
    clearEntry('session')
    setSearchOpen(false)
    setGotoOpen(false)
    setFocusMode(false)
    setProgress(0)
  }, [])

  // 파일 핸들을 받을 수 있는 브라우저에서는 최근 문서로 원본을 다시 열 수 있도록 파일 선택 창을 직접 띄운다
  const pickFile = useCallback(async () => {
    if (!window.showOpenFilePicker) {
      fileInputRef.current?.click()
      return
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: '텍스트 파일', accept: { 'text/plain': ['.txt', '.text', '.log'] } }],
      })
      openFile(await handle.getFile(), handle)
    } catch {
      // 선택을 취소한 경우
    }
  }, [openFile])

  const openRecent = useCallback(async () => {
    if (!recent) return
    const result = await reopenRecent(recent)
    if ('file' in result) {
      openFile(result.file, result.handle)
      return
    }
    if (result.error === 'denied') {
      showToast('파일을 열려면 접근 권한이 필요해요.', 2600)
      return
    }
    showToast('파일을 찾을 수 없어요. 삭제되었거나 다른 곳으로 옮겨졌을 수 있어요.', 3200)
    clearEntry('recent')
    setRecent(undefined)
  }, [recent, openFile, showToast])

  // ── 스크롤 · 읽던 위치 ────────────────────────────────
  const scrollToLine = useCallback((line: number, flash: boolean) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`)
    if (!el) return
    el.scrollIntoView({ block: flash ? 'center' : 'start' })
    if (flash) {
      el.classList.remove('flash')
      void el.offsetWidth
      el.classList.add('flash')
    }
  }, [])

  const onScroll = useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const scroller = scrollerRef.current
      const content = contentRef.current
      if (!scroller || !content) return

      const max = scroller.scrollHeight - scroller.clientHeight
      setProgress(max > 0 ? scroller.scrollTop / max : 1)

      const box = scroller.getBoundingClientRect()
      const x = Math.max(content.getBoundingClientRect().left, box.left) + 24
      const hit = document.elementFromPoint(x, box.top + 4)?.closest<HTMLElement>('.line')
      topLineRef.current = hit ? Number(hit.dataset.line) : scroller.scrollTop === 0 ? 1 : topLineRef.current

      const key = docKeyRef.current
      if (!key) return
      clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => savePosition(key, topLineRef.current), 400)
    })
  }, [])

  // 파일을 열면 마지막으로 읽던 줄로 돌아간다
  useEffect(() => {
    docKeyRef.current = doc?.key ?? null
    if (!doc) return
    const line = loadPosition(doc.key)
    topLineRef.current = line
    requestAnimationFrame(() => {
      if (line > 1) scrollToLine(line, false)
      else scrollerRef.current?.scrollTo({ top: 0 })
      scrollerRef.current?.focus({ preventScroll: true })
      onScroll()
    })
  }, [doc, scrollToLine, onScroll])

  // ── 검색 ──────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const debouncedQuery = useDebounced(query, 150)
  const effectiveQuery = searchOpen ? debouncedQuery : ''

  const search = useMemo(
    () => findMatches(lines, effectiveQuery, caseSensitive, topLineRef.current - 1),
    [lines, effectiveQuery, caseSensitive],
  )
  const matchesByLine = useMemo(() => {
    const map = new Map<number, MatchRange[]>()
    search.matches.forEach((m, i) => {
      const list = map.get(m.line)
      if (list) list.push([m.start, m.end, i])
      else map.set(m.line, [[m.start, m.end, i]])
    })
    return map
  }, [search])

  const [activeMatch, setActiveMatch] = useState(0)

  const goToMatch = useCallback((index: number) => {
    setActiveMatch(index)
    contentRef.current
      ?.querySelector(`[data-m="${index}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [])

  useEffect(() => {
    if (search.matches.length) goToMatch(search.start)
    else setActiveMatch(0)
  }, [search, goToMatch])

  const stepMatch = (dir: 1 | -1) => {
    const n = search.matches.length
    if (n) goToMatch((activeMatch + dir + n) % n)
  }

  const openSearch = useCallback(() => {
    setGotoOpen(false)
    setSearchOpen(true)
    requestAnimationFrame(() => {
      const input = document.getElementById('search-input') as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    scrollerRef.current?.focus({ preventScroll: true })
  }, [])

  const closeGoto = useCallback(() => {
    setGotoOpen(false)
    scrollerRef.current?.focus({ preventScroll: true })
  }, [])

  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const toggleFocus = useCallback(() => {
    setFocusMode((on) => {
      if (!on) showToast('F 또는 Esc로 집중 모드 종료')
      return !on
    })
  }, [showToast])

  // ── 키보드 단축키 ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'o') {
        e.preventDefault()
        pickFile()
        return
      }
      if (mod && key === 'f' && doc) {
        e.preventDefault()
        openSearch()
        return
      }
      if (mod && key === 'g' && doc) {
        e.preventDefault()
        setSearchOpen(false)
        setGotoOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false)
        else if (searchOpen) closeSearch()
        else if (gotoOpen) closeGoto()
        else if (focusMode) setFocusMode(false)
        return
      }

      if (mod || e.altKey) return
      if ((e.target as HTMLElement).closest('input, select, textarea')) return

      if (key === 'f' && doc) toggleFocus()
      else if (key === 't') {
        const i = THEMES.findIndex((t) => t.value === settings.theme)
        const next = THEMES[(i + 1) % THEMES.length]
        updateSetting('theme', next.value)
        showToast(`테마: ${next.label}`)
      } else if (e.key === '+' || e.key === '=') {
        updateSetting('fontSize', clamp(settings.fontSize + 1, FONT_SIZE.min, FONT_SIZE.max))
      } else if (e.key === '-') {
        updateSetting('fontSize', clamp(settings.fontSize - 1, FONT_SIZE.min, FONT_SIZE.max))
      } else if (key === 'l') {
        updateSetting('lineNumbers', !settings.lineNumbers)
      } else if (key === 'w') {
        updateSetting('wrap', !settings.wrap)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    doc,
    settings,
    settingsOpen,
    searchOpen,
    gotoOpen,
    focusMode,
    pickFile,
    openSearch,
    closeSearch,
    closeGoto,
    toggleFocus,
    updateSetting,
    showToast,
  ])

  // ── 드래그 앤 드롭 ────────────────────────────────────
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      // 핸들은 drop 이벤트 안에서 바로 요청해야 받을 수 있다
      const item = e.dataTransfer?.items[0]
      const handle = item?.kind === 'file' ? item.getAsFileSystemHandle?.() : undefined
      const file = e.dataTransfer?.files[0]
      if (!file) return
      Promise.resolve(handle)
        .catch(() => null)
        .then((h) => openFile(file, h?.kind === 'file' ? (h as FileSystemFileHandle) : undefined))
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  const activeLine = search.matches[activeMatch]?.line ?? -1

  return (
    <div className={`app${focusMode ? ' focus' : ''}`}>
      <header className="toolbar">
        {doc && (
          <button className="icon-btn back" onClick={goHome} title="처음 화면">
            <BackIcon />
          </button>
        )}
        <div className="title">
          {doc ? (
            <span className="name" title={doc.name}>
              {doc.name}
            </span>
          ) : (
            <span className="brand">Text Viewer</span>
          )}
        </div>
        {doc && (
          <>
            <button
              className={`icon-btn${searchOpen ? ' on' : ''}`}
              onClick={() => (searchOpen ? closeSearch() : openSearch())}
              title="검색 (Ctrl+F)"
            >
              <SearchIcon />
            </button>
            <button className="icon-btn" onClick={toggleFocus} title="집중 모드 (F)">
              <FocusIcon />
            </button>
          </>
        )}
        <button
          className={`icon-btn${settingsOpen ? ' on' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          title="보기 설정"
          data-settings-toggle
        >
          <TypeIcon />
        </button>
        <button className="icon-btn" onClick={pickFile} title="파일 열기 (Ctrl+O)">
          <OpenIcon />
        </button>
      </header>

      <main className="main">
        {doc ? (
          <>
            <div className="progress" style={{ width: `${progress * 100}%` }} />
            <Viewer
              lines={lines}
              matchesByLine={matchesByLine}
              activeMatch={activeMatch}
              activeLine={activeLine}
              settings={settings}
              scrollerRef={scrollerRef}
              contentRef={contentRef}
              onScroll={onScroll}
            />
          </>
        ) : (
          !restoring && (
            <EmptyState onOpen={pickFile} recentName={recent?.name} onOpenRecent={openRecent} error={error} />
          )
        )}

        {searchOpen && (
          <SearchBar
            query={query}
            onQuery={setQuery}
            caseSensitive={caseSensitive}
            onToggleCase={() => setCaseSensitive((v) => !v)}
            count={search.matches.length}
            capped={search.capped}
            active={activeMatch}
            pending={query !== debouncedQuery}
            onPrev={() => stepMatch(-1)}
            onNext={() => stepMatch(1)}
            onClose={closeSearch}
          />
        )}
        {gotoOpen && (
          <GotoBar
            total={lines.length}
            onGo={(line) => {
              closeGoto()
              scrollToLine(clamp(line, 1, lines.length), true)
            }}
            onClose={closeGoto}
          />
        )}
        {settingsOpen && <SettingsPanel settings={settings} onChange={updateSetting} onClose={closeSettings} />}

        {focusMode && (
          <button className="icon-btn focus-exit" onClick={toggleFocus} title="집중 모드 종료 (Esc)">
            <CloseIcon />
          </button>
        )}
        {toast ? (
          <div className="toast" role="status">
            {toast.text}
          </div>
        ) : (
          updateAvailable && (
            <button className="toast action" onClick={() => location.reload()}>
              새 버전이 준비됐어요. 새로고침하면 바로 반영됩니다.
            </button>
          )
        )}
      </main>

      {doc && (
        <footer className="status">
          <select
            value={encodingChoice}
            onChange={(e) => setEncodingChoice(e.target.value as EncodingChoice)}
            title="인코딩"
          >
            <option value="auto">
              {ENCODINGS.find((x) => x.value === detected)!.label} (자동)
            </option>
            {ENCODINGS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
          <span>{lines.length.toLocaleString()}줄</span>
          <span>{charCount.toLocaleString()}자</span>
          <span>{formatBytes(doc.size)}</span>
          <span className="spacer" />
          <span>{Math.round(progress * 100)}%</span>
        </footer>
      )}

      {dragging && (
        <div className="drop-overlay">
          <div>여기에 놓아서 열기</div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) openFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
