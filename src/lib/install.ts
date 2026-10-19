// 홈 화면 추가·앱 설치 안내
// - 아이폰·아이패드 Safari: 설치 버튼을 띄울 방법이 없어서 "공유 → 홈 화면에 추가" 방법을 알려준다.
//   홈 화면에 추가하지 않으면 7일 동안 방문하지 않을 때 서재(브라우저 저장 공간)가 지워질 수 있다.
// - Chrome·Edge(안드로이드·PC): 브라우저가 설치 가능하다고 알려주면 설치 버튼을 보여준다.

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
  notify()
})

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
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
  if (!dismissed && !isStandalone()) {
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
