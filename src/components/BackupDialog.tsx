import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createBackup, restoreBackup, type BackupSummary } from '../lib/backup'
import {
  connectedAccount,
  deleteBackup,
  disconnect,
  downloadBackup,
  driveConfigured,
  findBackup,
  isSignedIn,
  loadAccountEmail,
  preloadGoogle,
  signIn,
  uploadBackup,
  type DriveBackup,
} from '../lib/drive'
import { formatBytes } from '../lib/hooks'
import { AccountIcon, CloseIcon, CloudIcon, TrashIcon } from './Icons'

interface BackupDialogProps {
  onClose: () => void
  onRestored: (summary: BackupSummary) => void
  /** 연결한 적 있는 계정으로 화면을 열 때 이미 요청해 둔 로그인 (버튼을 누른 순간에 시작해야 막히지 않는다) */
  autoAuth?: Promise<string>
}

type Busy = 'connect' | 'backup' | 'restore' | 'delete' | null

/** 구글 계정인 건 알고 있으니 @ 뒤는 빼고 보여준다 */
function accountName(email: string) {
  return email.split('@')[0]
}

const ERRORS: Record<string, string> = {
  'google-unavailable': '구글에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.',
  'popup_closed': '로그인 창이 닫혔어요.',
  'popup_failed_to_open': '로그인 창을 열 수 없어요. 팝업 차단을 확인해 주세요.',
  'access_denied': '드라이브 접근을 허용해야 백업할 수 있어요.',
  'signed-out': '로그인이 만료됐어요. 다시 연결해 주세요.',
  'invalid-backup': '백업 파일을 읽을 수 없어요.',
  'scope-denied':
    '드라이브 접근이 허용되지 않았어요. 다시 연결할 때 “Google Drive에서 이 앱의 구성 데이터 보기 및 관리”에 체크해 주세요.',
  'api-disabled': '이 앱의 Google Cloud 프로젝트에서 Google Drive API가 꺼져 있어요.',
}

function errorMessage(e: unknown) {
  const code = e instanceof Error ? e.message : String(e)
  // 모르는 오류는 원인을 찾을 수 있도록 코드를 함께 보여준다
  return ERRORS[code] ?? `문제가 생겼어요. 잠시 후 다시 시도해 주세요. (${code || 'unknown'})`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** 구글 드라이브의 앱 전용 공간에 서재를 백업하고 불러온다 */
export function BackupDialog({ onClose, onRestored, autoAuth }: BackupDialogProps) {
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [account, setAccount] = useState(connectedAccount)
  /** undefined: 아직 모름, null: 백업 없음 */
  const [backup, setBackup] = useState<DriveBackup | null>()
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean }>()

  const loadInfo = useCallback(async () => {
    setBackup(undefined)
    setBackup((await findBackup()) ?? null)
  }, [])

  // 연결한 뒤 계정 이메일(처음 한 번)과 마지막 백업을 읽는다
  const afterConnect = useCallback(async () => {
    if (!connectedAccount()) setAccount(await loadAccountEmail())
    else setAccount(connectedAccount())
    await loadInfo()
  }, [loadInfo])

  // 로그인 창은 버튼을 누른 처리 안에서 곧바로 띄워야 막히지 않는다 — 그래서 signIn()을 먼저 부른다
  const run = (kind: Busy, task: () => Promise<void>, auth = signIn()) => {
    setBusy(kind)
    setMessage(undefined)
    auth
      .then(() => {
        setSignedIn(true)
        return task()
      })
      .catch((e) => {
        if (!isSignedIn()) setSignedIn(false)
        setMessage({ text: errorMessage(e), error: true })
      })
      .finally(() => setBusy(null))
  }

  const connect = () => run('connect', afterConnect)

  const started = useRef(false)
  useEffect(() => {
    if (!driveConfigured || started.current) return
    started.current = true
    preloadGoogle().catch((e) => setMessage({ text: errorMessage(e), error: true }))
    if (autoAuth) run('connect', afterConnect, autoAuth)
    else if (isSignedIn()) afterConnect().catch((e) => setMessage({ text: errorMessage(e), error: true }))
    // 화면을 열 때 한 번만
  }, [])

  const unlink = () => {
    disconnect()
    setAccount(null)
    setSignedIn(false)
    setBackup(undefined)
    setMessage({ text: '구글 계정 연결을 해제했어요. 드라이브의 백업은 그대로 남아 있어요.' })
  }

  const backupNow = () =>
    run('backup', async () => {
      const { blob, works, episodes } = await createBackup()
      await uploadBackup(blob)
      await loadInfo()
      setMessage({ text: `백업했어요 · 작품 ${works}개, ${episodes}편` })
    })

  const restore = () => {
    if (!backup) return
    const ok = confirm(
      `${formatDate(backup.modifiedTime)} 백업으로 지금 서재를 바꿀까요?\n지금 서재에만 있는 작품은 사라져요.`,
    )
    if (!ok) return
    run('restore', async () => {
      const summary = await restoreBackup(await downloadBackup(backup.id))
      onRestored(summary)
    })
  }

  const remove = () => {
    if (!backup) return
    if (!confirm('드라이브에 있는 백업을 삭제할까요?\n삭제하면 되돌릴 수 없어요. 이 기기의 서재는 그대로예요.')) return
    run('delete', async () => {
      await deleteBackup(backup.id)
      await loadInfo()
      setMessage({ text: '드라이브 백업을 삭제했어요.' })
    })
  }

  // 백업이 있으면 날짜와 용량을 한 줄씩 보여준다
  let status: ReactNode = account !== null ? '연결하면 보여요' : '연결 전'
  if (signedIn) {
    if (backup === undefined) status = '확인 중…'
    else if (backup === null) status = '아직 없어요'
    else
      status = (
        <>
          <span>{formatDate(backup.modifiedTime)}</span>
          <span>{formatBytes(backup.size)}</span>
        </>
      )
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-label="구글 드라이브 백업">
        <header className="sheet-head">
          <div>
            <span className="eyebrow">GOOGLE DRIVE</span>
            <p>서재를 내 구글 드라이브에 보관하고, 다른 기기에서 불러올 수 있어요.</p>
          </div>
          <button className="round-btn sheet-close" onClick={onClose} title="닫기" disabled={!!busy}>
            <CloseIcon />
          </button>
        </header>

        {!driveConfigured ? (
          <p className="backup-note">구글 드라이브 연결 설정이 아직 안 됐어요.</p>
        ) : (
          <>
            <div className="opt-list">
              {/* 켜면 구글 계정을 연결하고, 끄면 연결을 해제한다 (드라이브의 백업은 남는다) */}
              <label className="opt">
                <span className="opt-main">
                  <span className="opt-icon">
                    <AccountIcon size={18} />
                  </span>
                  <span className="opt-text">
                    <span className="opt-title">구글 계정 연결</span>
                    <span className="opt-desc">
                      {busy === 'connect' ? '연결 중…' : account ? accountName(account) : '연결하면 백업할 수 있어요'}
                    </span>
                  </span>
                </span>
                <button
                  role="switch"
                  aria-checked={account !== null}
                  className={`switch${account !== null || busy === 'connect' ? ' on' : ''}`}
                  onClick={() => (account !== null ? unlink() : connect())}
                  disabled={!!busy}
                />
              </label>
              <div className="opt">
                <span className="opt-main">
                  <span className="opt-icon">
                    <CloudIcon size={18} />
                  </span>
                  <span className="opt-title">마지막 백업</span>
                </span>
                <span className="backup-status">{status}</span>
              </div>
              {backup && (
                <button className="opt opt-link danger" onClick={remove} disabled={!!busy}>
                  <span className="opt-main">
                    <span className="opt-icon">
                      <TrashIcon size={18} />
                    </span>
                    <span className="opt-text">
                      <span className="opt-title">{busy === 'delete' ? '삭제하는 중…' : '드라이브 백업 삭제'}</span>
                      <span className="opt-desc">이 기기의 서재는 그대로 남아요</span>
                    </span>
                  </span>
                </button>
              )}
            </div>

            <p className="backup-note">
              작품, 편 내용, 표지, 읽은 위치가 파일 하나로 저장돼요.
              <br />
              앱 전용 공간이라 드라이브 목록에는 보이지 않아요.
            </p>

            {message && <p className={`backup-message${message.error ? ' error' : ''}`}>{message.text}</p>}

            <div className="modal-actions">
              <button className="ghost" onClick={restore} disabled={!backup || !!busy}>
                {busy === 'restore' ? '불러오는 중…' : '불러오기'}
              </button>
              <button className="primary" onClick={backupNow} disabled={!!busy}>
                {busy === 'backup' ? '백업 중…' : '지금 백업하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
