import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddDialog } from './components/AddDialog'
import { BackupDialog } from './components/BackupDialog'
import { connectedAccount, isSignedIn, signIn } from './lib/drive'
import { EmptyState } from './components/EmptyState'
import { GotoBar } from './components/GotoBar'
import {
  BackIcon,
  CloseIcon,
  FileIcon,
  FocusIcon,
  LibraryIcon,
  MoreIcon,
  NextIcon,
  OpenIcon,
  SaveIcon,
  SavedIcon,
  SearchIcon,
  TypeIcon,
} from './components/Icons'
import { Library } from './components/Library'
import { ReaderMenu, type ReaderMenuItem } from './components/ReaderMenu'
import { SearchBar } from './components/SearchBar'
import { SettingsPanel } from './components/SettingsPanel'
import { Viewer, type MatchRange } from './components/Viewer'
import { WorkDetail } from './components/WorkDetail'
import { ENCODINGS, decode, detectEncoding, type EncodingChoice } from './lib/decode'
import { formatBytes, useDebounced, useResolvedTheme, useUpdateAvailable } from './lib/hooks'
import {
  addToLibrary,
  deleteEpisode,
  deleteWork,
  episodeKey,
  extractHue,
  groupFiles,
  listLibrary,
  loadEpisodeFile,
  parseEpisodeNames,
  prepareCover,
  updateWork,
  type Episode,
  type PendingGroup,
  type WorkSummary,
} from './lib/library'
import { findMatches } from './lib/search'
import { HOME, historyDepth, parseRoute, pushRoute, replaceRoute, type Route, type View } from './lib/route'
import {
  clearEntry,
  isSessionOpen,
  loadEntry,
  loadSessionState,
  reopenRecent,
  restoreRecent,
  saveEntry,
  saveSessionState,
  setSessionOpen,
  type RecentEntry,
} from './lib/recent'
import { loadPosition, loadSettings, readPositions, savePosition, saveSettings } from './lib/storage'
import { FONT_SIZE, THEMES, clamp, type Settings } from './settings'

interface Doc {
  key: string
  name: string
  size: number
  buffer: ArrayBuffer
  file: File
  handle?: FileSystemFileHandle
  /** 서재에서 연 편 */
  episode?: Episode
}

/** 새로고침 후 같은 상태로 돌아오기 위해 탭에 기억해 두는 것 (보던 화면은 주소에 있다) */
interface SessionState {
  episodeId?: string
  /** 열려 있던 패널 — 개인정보처리방침에 다녀오거나 새로고침해도 그대로 다시 연다 */
  panel?: 'settings' | 'backup'
}

const ACCEPT = '.txt,.text,.log,text/plain'
// 읽는 화면의 머리 높이 (styles.css의 .toolbar와 같다). 본문은 이 아래에서 시작하고, 읽던 줄도 이 높이에서 잰다
const HEADER_H = 64
// 이만큼 이어서 내려 읽으면 머리를 숨기고, 이만큼 올리면 다시 보인다
const HEADER_SWAY = 24

// 설정 시트가 아래로 내려가며 닫히는 시간 (styles.css의 .panel.leaving과 같다)
const SHEET_LEAVE_MS = 220

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])
  useEffect(() => saveSettings(settings), [settings])

  const theme = useResolvedTheme(settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // 모바일 상단 상태 표시줄 색도 테마 배경에 맞춘다
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  }, [theme])

  // ── 문서 ──────────────────────────────────────────────
  const [doc, setDoc] = useState<Doc | null>(null)
  const [encodingChoice, setEncodingChoice] = useState<EncodingChoice>('auto')
  const [error, setError] = useState<string | null>(null)
  const detected = useMemo(() => (doc ? detectEncoding(doc.buffer) : 'utf-8'), [doc])
  const encoding = encodingChoice === 'auto' ? detected : encodingChoice
  const lines = useMemo(() => (doc ? decode(doc.buffer, encoding).split(/\r\n|\r|\n/) : []), [doc, encoding])
  const charCount = useMemo(() => lines.reduce((n, l) => n + l.length, 0), [lines])

  // ── UI 상태 ───────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(() => loadSessionState<SessionState>()?.panel === 'settings')
  const [backupOpen, setBackupOpen] = useState(() => loadSessionState<SessionState>()?.panel === 'backup')
  const [backupAuth, setBackupAuth] = useState<Promise<string>>()
  /** 백업 화면을 닫으면 보기 설정으로 돌아간다 — 그때 보여줄 설정 스크롤 위치 */
  const [settingsReturnScroll, setSettingsReturnScroll] = useState<number>()
  /** 휴대폰 읽기 화면의 ⋯ 메뉴 */
  const [menuOpen, setMenuOpen] = useState(false)
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
  // 읽는 화면의 머리: 내려 읽으면 위로 숨고, 올려 읽으면 다시 내려온다
  const [headerTucked, setHeaderTucked] = useState(false)
  const lastScrollTop = useRef(0)
  const scrollSway = useRef(0)

  const showToast = useCallback((text: string, ms = 1800) => setToast({ text, ms }), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.ms)
    return () => clearTimeout(id)
  }, [toast])

  const openFile = useCallback(async (file: File, handle?: FileSystemFileHandle, episode?: Episode) => {
    try {
      const buffer = await file.arrayBuffer()
      setDoc({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        size: file.size,
        buffer,
        file,
        handle,
        episode,
      })
      setEncodingChoice('auto')
      setError(null)
      setQuery('')
      setSearchOpen(false)
      setGotoOpen(false)
      setProgress(0)
      setSessionOpen(true)
      const route = parseRoute()
      if (!route.reading) pushRoute({ ...route, reading: true })
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

  // ── 내 서재 ───────────────────────────────────────────
  // 아래 effect가 곧바로 덮어쓰므로 새로고침 전 상태는 첫 렌더에서 한 번만 읽어 둔다
  const [initialSession] = useState(() => loadSessionState<SessionState>())
  const [view, setView] = useState<View>(() => parseRoute().view)
  const [library, setLibrary] = useState<WorkSummary[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [positions, setPositions] = useState(readPositions)
  const [adding, setAdding] = useState<PendingGroup[] | null>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  /** "편 추가하기"로 파일을 고를 때 담을 작품 */
  const addTargetRef = useRef<string | null>(null)

  const refreshLibrary = useCallback(
    () =>
      listLibrary()
        .then(setLibrary)
        .catch(() => showToast('서재를 불러오지 못했어요.'))
        .finally(() => setLibraryLoaded(true)),
    [showToast],
  )
  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

  // 문서를 닫고 목록으로 돌아올 때 읽은 정도를 새로 반영한다
  useEffect(() => {
    if (!doc) setPositions(readPositions())
  }, [doc, view])

  useEffect(() => {
    const panel = settingsOpen ? 'settings' : backupOpen ? 'backup' : undefined
    saveSessionState({ episodeId: doc?.episode?.id, panel } satisfies SessionState)
  }, [doc, settingsOpen, backupOpen])

  const openEpisode = useCallback(
    async (episode: Episode) => {
      const file = await loadEpisodeFile(episode).catch(() => undefined)
      if (file) openFile(file, undefined, episode)
      else showToast('이 편의 내용을 찾을 수 없어요.')
    },
    [openFile, showToast],
  )

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
    const restore = async (): Promise<{ file: File; handle?: FileSystemFileHandle; episode?: Episode } | undefined> => {
      // 서재에서 연 편이면 서재에서 다시 꺼낸다 — 다음 편 버튼과 뒤로 가기가 그대로 동작하도록
      const episodeId = initialSession?.episodeId
      if (episodeId) {
        const episode = (await listLibrary()).flatMap((s) => s.episodes).find((e) => e.id === episodeId)
        const file = episode && (await loadEpisodeFile(episode))
        if (file) return { file, episode }
      }
      const entry = await loadEntry('session')
      return entry ? await restoreRecent(entry) : undefined
    }
    restore()
      .catch(() => undefined)
      .then(async (restored) => {
        if (restored) await openFile(restored.file, restored.handle, restored.episode)
        else setSessionOpen(false)
        setRestoring(false)
        // 주소는 글을 여는 중인데 열 글이 없으면 주소를 바로잡는다
        const route = parseRoute()
        if (!restored && route.reading) replaceRoute({ ...route, reading: false })
      })
  }, [openFile, initialSession])

  const closeDoc = useCallback(() => {
    setDoc(null)
    setSessionOpen(false)
    clearEntry('session')
    setSearchOpen(false)
    setGotoOpen(false)
    setFocusMode(false)
    setProgress(0)
  }, [])

  // ── 화면 이동 (주소와 함께) ───────────────────────────
  const navigate = useCallback(
    (next: View, replace = false) => {
      if (doc) closeDoc()
      const route: Route = { view: next, reading: false }
      if (replace) replaceRoute(route)
      else pushRoute(route)
      setView(next)
    },
    [doc, closeDoc],
  )

  // 브라우저·폰의 뒤로/앞으로 가기, 주소 직접 입력
  const docRef = useRef(doc)
  docRef.current = doc
  useEffect(() => {
    const onPop = () => {
      const route = parseRoute()
      setView(route.view)
      if (!route.reading && docRef.current) closeDoc()
      // 앞으로 가기로 /read에 왔는데 열린 글이 없으면 주소를 바로잡는다
      if (route.reading && !docRef.current) replaceRoute({ ...route, reading: false })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeDoc])

  const goBack = () => {
    // 앱 안에서 넘어온 화면이면 브라우저 뒤로 가기와 똑같이 움직인다
    if (historyDepth() > 0) {
      history.back()
      return
    }
    // 링크로 바로 들어왔거나 새로고침한 화면: 한 단계 위 화면으로 바꿔 넣는다
    if (doc) {
      closeDoc()
      replaceRoute({ view, reading: false })
    } else navigate(view.name === 'work' ? { name: 'library' } : HOME, true)
  }

  const openLibrary = () => navigate({ name: 'library' })

  const libraryEpisode = useMemo(
    () => (doc ? library.flatMap((s) => s.episodes).find((e) => episodeKey(e) === doc.key) : undefined),
    [doc, library],
  )

  const startAdd = useCallback(
    (items: { file: File; buffer: ArrayBuffer }[]) => {
      const known = library.flatMap((s) => s.episodes.map((e) => e.fileName))
      const parsed = parseEpisodeNames(
        items.map(({ file }) => file.name),
        known,
      )
      const pending = items.map(({ file, buffer }, i) => ({ file, buffer, parsed: parsed[i] }))
      setAdding(groupFiles(pending, library.map((s) => s.work)))
    },
    [library],
  )

  const confirmAdd = useCallback(
    async (groups: PendingGroup[]) => {
      setAdding(null)
      try {
        const { added, skipped } = await addToLibrary(groups)
        await refreshLibrary()
        if (!added) showToast(skipped > 1 ? `${skipped}편 모두 이미 서재에 있어요.` : '이미 서재에 있는 편이에요.', 2600)
        else if (skipped) showToast(`${added}편을 담았어요. 이미 있는 ${skipped}편은 제외했어요.`, 3000)
        else showToast(added > 1 ? `${added}편을 서재에 담았어요.` : '서재에 담았어요.')
      } catch {
        showToast('서재에 담지 못했어요. 저장 공간을 확인해 주세요.', 2600)
      }
    },
    [refreshLibrary, showToast],
  )

  const onLibraryFiles = async (files: File[]) => {
    const items = await Promise.all(files.map(async (file) => ({ file, buffer: await file.arrayBuffer() })))
    const target = addTargetRef.current
    addTargetRef.current = null
    if (!target) {
      startAdd(items)
      return
    }
    // 작품 화면의 "편 추가하기" — 묻지 않고 그 작품에 담는다
    const known = library.find((s) => s.work.id === target)?.episodes.map((e) => e.fileName)
    const parsed = parseEpisodeNames(
      items.map(({ file }) => file.name),
      known,
    )
    const pending = items.map(({ file, buffer }, i) => ({ file, buffer, parsed: parsed[i] }))
    confirmAdd([{ target, title: '', files: groupFiles(pending, []).flatMap((g) => g.files) }])
  }

  const workSummary = view.name === 'work' ? library.find((s) => s.work.id === view.workId) : undefined

  const removeEpisode = async (episode: Episode) => {
    if (!confirm(`'${episode.title}'을(를) 서재에서 삭제할까요?`)) return
    await deleteEpisode(episode)
    await refreshLibrary()
  }

  const removeWork = async (summary: WorkSummary) => {
    if (!confirm(`'${summary.work.title}'과(와) ${summary.episodes.length}편을 모두 서재에서 삭제할까요?`)) return
    await deleteWork(summary.work.id)
    await refreshLibrary()
    navigate({ name: 'library' }, true)
  }

  // 서재 편집에서 고른 작품들을 한 번에 지운다
  const removeWorks = async (works: WorkSummary[]) => {
    const episodes = works.reduce((n, s) => n + s.episodes.length, 0)
    const what = works.length === 1 ? `'${works[0].work.title}'과(와) ${episodes}편을` : `작품 ${works.length}개와 ${episodes}편을`
    if (!confirm(`${what} 모두 서재에서 삭제할까요?`)) return false
    try {
      for (const s of works) await deleteWork(s.work.id)
      showToast(works.length === 1 ? '작품을 삭제했어요.' : `작품 ${works.length}개를 삭제했어요.`)
    } catch {
      showToast('삭제하지 못했어요. 다시 시도해 주세요.', 2600)
    }
    await refreshLibrary()
    return true
  }

  const changeCover = async (summary: WorkSummary, file: File | null) => {
    try {
      const cover = file ? await prepareCover(file) : undefined
      const coverHue = cover && (await extractHue(cover))
      await updateWork(summary.work.id, { cover, coverHue })
      await refreshLibrary()
    } catch {
      showToast('이 이미지는 표지로 쓸 수 없어요.')
    }
  }

  // 연재글이면 본문 끝에 다음 편으로 넘어가는 버튼을 단다
  const episodeNav = useMemo(() => {
    const episode = doc?.episode
    if (!episode) return null
    const summary = library.find((s) => s.work.id === episode.workId)
    if (!summary) return null
    const index = summary.episodes.findIndex((e) => e.id === episode.id)
    return { summary, current: summary.episodes[index] ?? episode, next: summary.episodes[index + 1] }
  }, [doc, library])

  const viewerFooter = useMemo(() => {
    if (!episodeNav || episodeNav.summary.episodes.length < 2) return undefined
    const { current, next } = episodeNav
    return (
      <div className="ep-footer">
        <span className="ep-end">{current.title} 끝</span>
        {next ? (
          <button className="next-ep" onClick={() => openEpisode(next)}>
            <span>
              <small>다음 편</small> {next.title}
            </span>
            <NextIcon />
          </button>
        ) : (
          <span className="ep-last">마지막 편이에요</span>
        )}
      </div>
    )
  }, [episodeNav, openEpisode])

  const docTitle = episodeNav
    ? episodeNav.summary.episodes.length > 1
      ? `${episodeNav.summary.work.title} · ${episodeNav.current.title}`
      : episodeNav.summary.work.title
    : doc?.name

  useEffect(() => {
    document.title = docTitle ? `${docTitle} — Text Viewer` : 'Text Viewer'
  }, [docTitle])

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
      const ratio = max > 0 ? scroller.scrollTop / max : 1
      setProgress(ratio)

      // 같은 방향으로 어느 정도 움직였을 때만 머리를 넣고 빼서, 살짝 흔들리는 정도로는 깜빡이지 않게 한다
      const top = scroller.scrollTop
      const delta = top - lastScrollTop.current
      lastScrollTop.current = top
      scrollSway.current = Math.sign(delta) === Math.sign(scrollSway.current) ? scrollSway.current + delta : delta
      if (top < HEADER_H) setHeaderTucked(false)
      else if (scrollSway.current > HEADER_SWAY) setHeaderTucked(true)
      else if (scrollSway.current < -HEADER_SWAY) setHeaderTucked(false)

      const box = scroller.getBoundingClientRect()
      const x = Math.max(content.getBoundingClientRect().left, box.left) + 24
      const hit = document.elementFromPoint(x, box.top + HEADER_H + 4)?.closest<HTMLElement>('.line')
      topLineRef.current = hit ? Number(hit.dataset.line) : scroller.scrollTop === 0 ? 1 : topLineRef.current

      const key = docKeyRef.current
      if (!key) return
      clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => savePosition(key, topLineRef.current, ratio), 400)
    })
  }, [])

  // 파일을 열면 마지막으로 읽던 줄로 돌아간다
  useEffect(() => {
    docKeyRef.current = doc?.key ?? null
    if (!doc) return
    const line = loadPosition(doc.key)
    topLineRef.current = line
    setHeaderTucked(false)
    requestAnimationFrame(() => {
      if (line > 1) scrollToLine(line, false)
      else scrollerRef.current?.scrollTo({ top: 0 })
      scrollerRef.current?.focus({ preventScroll: true })
      // 읽던 곳으로 옮겨 간 것은 내려 읽은 것이 아니므로 머리를 숨기지 않는다
      lastScrollTop.current = scrollerRef.current?.scrollTop ?? 0
      scrollSway.current = 0
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

  // 닫을 때는 아래로 내려가는 움직임을 다 보여준 뒤에 패널을 치운다
  const [settingsLeaving, setSettingsLeaving] = useState(false)
  const closeSettings = useCallback(() => setSettingsLeaving(true), [])
  useEffect(() => {
    if (!settingsLeaving) return
    const timer = setTimeout(() => {
      setSettingsOpen(false)
      setSettingsReturnScroll(undefined)
      setSettingsLeaving(false)
    }, SHEET_LEAVE_MS)
    return () => clearTimeout(timer)
  }, [settingsLeaving])

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
        if (menuOpen) setMenuOpen(false)
        else if (settingsOpen) closeSettings()
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
    closeSettings,
    menuOpen,
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

  // 휴대폰 읽기 화면의 ⋯ 메뉴 — 머리에서 숨긴 버튼들
  const readerMenuItems: ReaderMenuItem[] = doc
    ? [
        libraryEpisode
          ? {
              icon: <SavedIcon />,
              label: '서재에서 작품 보기',
              onSelect: () => navigate({ name: 'work', workId: libraryEpisode.workId }),
            }
          : { icon: <SaveIcon />, label: '서재에 담기', onSelect: () => startAdd([{ file: doc.file, buffer: doc.buffer }]) },
        { icon: <SearchIcon />, label: '검색', hint: 'Ctrl F', onSelect: openSearch },
        { icon: <FocusIcon />, label: '집중 모드', hint: 'F', onSelect: toggleFocus },
        // 순서는 PC 머리 버튼 순서와 같게 (담기 · 검색 · 집중 · 서재 · 열기)
        { icon: <LibraryIcon />, label: '내 서재', onSelect: openLibrary },
        { icon: <OpenIcon />, label: '다른 파일 열기', hint: 'Ctrl O', onSelect: pickFile },
      ]
    : []

  const activeLine = search.matches[activeMatch]?.line ?? -1

  return (
    <div className={`app${focusMode ? ' focus' : ''}`}>
      <header
        className={`toolbar${doc ? ' reading' : ''}${doc && headerTucked && !searchOpen && !menuOpen ? ' tucked' : ''}`}
      >
        {(doc || view.name !== 'home') && (
          <button className="icon-btn round back" onClick={goBack} title="뒤로">
            <BackIcon />
          </button>
        )}
        <div className="title">
          {doc ? (
            <span className="name" title={docTitle}>
              {docTitle}
            </span>
          ) : view.name === 'home' ? (
            <span className="brand">
              <FileIcon />
              Text Viewer
            </span>
          ) : null}
        </div>
        {doc &&
          (libraryEpisode ? (
            <button
              className="icon-btn round reader-extra"
              onClick={() => {
                navigate({ name: 'work', workId: libraryEpisode.workId })
              }}
              title="서재에 있어요 · 작품 보기"
            >
              <SavedIcon />
            </button>
          ) : (
            <button
              className="icon-btn round reader-extra"
              onClick={() => startAdd([{ file: doc.file, buffer: doc.buffer }])}
              title="서재에 담기"
            >
              <SaveIcon />
            </button>
          ))}
        {doc && (
          <>
            <button
              className={`icon-btn round reader-extra${searchOpen ? ' on' : ''}`}
              onClick={() => (searchOpen ? closeSearch() : openSearch())}
              title="검색 (Ctrl+F)"
            >
              <SearchIcon />
            </button>
            <button className="icon-btn round reader-extra" onClick={toggleFocus} title="집중 모드 (F)">
              <FocusIcon />
            </button>
          </>
        )}
        <button
          className={`icon-btn round${settingsOpen ? ' on' : ''}`}
          onClick={() => {
            if (settingsOpen && !settingsLeaving) closeSettings()
            else {
              setSettingsLeaving(false)
              setSettingsOpen(true)
            }
          }}
          title="보기 설정"
          data-settings-toggle
        >
          <TypeIcon />
        </button>
        <button
          className={`icon-btn round reader-extra${!doc && view.name !== 'home' ? ' on' : ''}`}
          onClick={openLibrary}
          title="내 서재"
        >
          <LibraryIcon />
        </button>
        <button className="icon-btn round reader-extra" onClick={pickFile} title="파일 열기 (Ctrl+O)">
          <OpenIcon />
        </button>
        {doc && (
          <button className={`icon-btn round more-btn${menuOpen ? ' on' : ''}`} onClick={() => setMenuOpen(true)} title="더보기">
            <MoreIcon size={18} />
          </button>
        )}
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
              footer={viewerFooter}
            />
          </>
        ) : restoring || (view.name !== 'home' && !libraryLoaded) ? null : workSummary ? (
          <WorkDetail
            summary={workSummary}
            positions={positions}
            onOpenEpisode={openEpisode}
            onRename={(title) => updateWork(workSummary.work.id, { title }).then(refreshLibrary)}
            onCover={(file) => changeCover(workSummary, file)}
            onAddEpisodes={() => {
              addTargetRef.current = workSummary.work.id
              libraryInputRef.current?.click()
            }}
            onDeleteEpisode={removeEpisode}
            onDeleteWork={() => removeWork(workSummary)}
          />
        ) : view.name !== 'home' ? (
          <Library
            items={library}
            positions={positions}
            onOpen={(s) => (s.episodes.length === 1 ? openEpisode(s.episodes[0]) : navigate({ name: 'work', workId: s.work.id }))}
            onDetail={(s) => navigate({ name: 'work', workId: s.work.id })}
            onDeleteWorks={removeWorks}
            onAdd={() => {
              addTargetRef.current = null
              libraryInputRef.current?.click()
            }}
          />
        ) : (
          <EmptyState onOpen={pickFile} recentName={recent?.name} onOpenRecent={openRecent} error={error} />
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
        {menuOpen && doc && <ReaderMenu items={readerMenuItems} onClose={() => setMenuOpen(false)} />}
        {settingsOpen && <div className={`sheet-backdrop${settingsLeaving ? " leaving" : ""}`} aria-hidden />}
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={updateSetting}
            onClose={closeSettings}
            leaving={settingsLeaving}
            initialScrollTop={settingsReturnScroll}
            onOpenBackup={(scrollTop) => {
              setSettingsReturnScroll(scrollTop)
              // 연결한 적 있는 계정이면 이 클릭에서 바로 조용히 다시 연결한다
              const reconnect = connectedAccount() !== null && !isSignedIn() && !!window.google?.accounts?.oauth2
              setBackupAuth(reconnect ? signIn() : undefined)
              setSettingsOpen(false)
              setBackupOpen(true)
            }}
          />
        )}

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

      {adding && (
        <AddDialog
          groups={adding}
          works={library.map((s) => s.work)}
          onCancel={() => setAdding(null)}
          onConfirm={confirmAdd}
        />
      )}

      {backupOpen && (
        <BackupDialog
          autoAuth={backupAuth}
          onClose={() => {
            // 백업은 보기 설정에서 들어오므로, 닫으면 보던 설정 화면으로 돌아간다
            setBackupOpen(false)
            setBackupAuth(undefined)
            setSettingsOpen(true)
          }}
          onRestored={async ({ works, episodes }) => {
            // 불러오기가 끝나면 설정으로 돌아가지 않고 바뀐 서재를 바로 보여준다
            setBackupOpen(false)
            setSettingsReturnScroll(undefined)
            await refreshLibrary()
            setPositions(readPositions())
            showToast(`백업에서 작품 ${works}개, ${episodes}편을 불러왔어요.`, 2600)
          }}
        />
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
      <input
        ref={libraryInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) onLibraryFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
