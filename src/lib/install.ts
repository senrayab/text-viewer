// 홈 화면 추가·앱 설치 안내
// - 아이폰·아이패드 Safari: 설치 버튼을 띄울 방법이 없어서 "공유 → 홈 화면에 추가" 방법을 알려준다.
//   홈 화면에 추가하지 않으면 7일 동안 방문하지 않을 때 서재(브라우저 저장 공간)가 지워질 수 있다.
// - 안드로이드 Chrome·삼성 인터넷 등: 브라우저가 설치 가능하다고 알려주면 설치 버튼을 보여준다.
// - PC에서는 보여주지 않는다. 앱으로 실행 중이거나, 이미 설치한 것을 브라우저가 알려주면 휴대폰에서도 숨긴다.

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'text-viewer:install-hint-dismissed'

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  installed = true
  notify()
})

// 이미 설치한 앱이 있는지 (안드로이드 Chrome 등에서만 알 수 있다 — manifest의 related_applications로 이 앱을 가리킨다)
let installed = false
;(navigator as { getInstalledRelatedApps?: () => Promise<unknown[]> })
  .getInstalledRelatedApps?.()
  .then((apps) => {
    if (!apps.length) return
    installed = true
    notify()
  })
  .catch(() => {})

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** 휴대폰·태블릿 (설치 안내는 여기서만 보인다) */
function isMobile() {
  const data = (navigator as { userAgentData?: { mobile: boolean } }).userAgentData
  return isIos() || /Android/i.test(navigator.userAgent) || data?.mobile === true
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export type InstallHintKind = 'ios' | 'prompt' | null

export function useInstallHint() {
  const [, rerender] = useState(0)
  const [dismissed, setDismissed] = useState(isDismissed)

  useEffect(() => {
    const update = () => rerender((n) => n + 1)
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])

  let kind: InstallHintKind = null
  if (!dismissed && !installed && !isStandalone() && isMobile()) {
    if (isIos()) kind = 'ios'
    else if (deferredPrompt) kind = 'prompt'
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    deferredPrompt = null
    notify()
  }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 무시
    }
    setDismissed(true)
  }

  return { kind, install, dismiss }
}
