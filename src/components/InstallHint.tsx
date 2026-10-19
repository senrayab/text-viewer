import { useInstallHint } from '../lib/install'
import { CloseIcon, PhoneIcon, ShareIcon } from './Icons'

/** 서재 상단의 홈 화면 추가·앱 설치 안내. 필요 없는 환경이거나 닫았으면 보이지 않는다. */
export function InstallHint() {
  const { kind, install, dismiss } = useInstallHint()
  if (!kind) return null

  return (
    <div className="hint-card">
      <span className="chip chip-sky">
        <PhoneIcon />
      </span>
      <div className="hint-body">
        {kind === 'ios' ? (
          <>
            <strong>홈 화면에 추가해 두세요</strong>
            <p>
              Safari는 7일 동안 방문하지 않으면 서재를 지울 수 있어요. 아래쪽 공유 버튼{' '}
              <span className="inline-icon">
                <ShareIcon />
              </span>{' '}
              을 누르고 <b>홈 화면에 추가</b>를 고르면 안전하게 보관돼요.
            </p>
          </>
        ) : (
          <>
            <strong>앱으로 설치해 두세요</strong>
            <p>홈 화면에서 앱처럼 바로 열 수 있어요.</p>
            <button className="pill small dark" onClick={install}>
              설치하기
            </button>
          </>
        )}
      </div>
      <button className="icon-btn small" onClick={dismiss} title="닫기">
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
