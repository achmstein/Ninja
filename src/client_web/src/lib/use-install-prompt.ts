import { useSyncExternalStore } from 'react'

/**
 * Installability of the customer PWA.
 *
 * Chromium browsers (Android Chrome, Samsung Internet, desktop Chrome/Edge)
 * announce it with `beforeinstallprompt` — once, and early, often before
 * React has mounted — so the listener lives at module scope and the event is
 * parked here until a component asks for it. iOS has no prompt at all: there
 * the app can only explain Safari's "Share → Add to Home Screen".
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep Chrome's own mini-infobar out of the way; the app asks itself
    event.preventDefault()
    setDeferredPrompt(event as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => setDeferredPrompt(null))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return deferredPrompt
}

/** Running from the home screen (Chromium display-mode, or Safari's flag). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

// Facebook, Instagram, TikTok… open links in their own web view, whose share
// sheet has no "Add to Home Screen" — pointing those customers at it would
// only confuse them
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|TikTok|musical_ly|Snapchat|Line\//i

/**
 * iOS or iPadOS, where installing means "Share → Add to Home Screen" and
 * `beforeinstallprompt` never fires. iPadOS Safari calls itself a Mac, so
 * that case falls back to touch support.
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  try {
    const ua = navigator.userAgent ?? ''
    const iPadOs =
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return (/iPad|iPhone|iPod/.test(ua) || iPadOs) && !IN_APP_BROWSER.test(ua)
  } catch {
    return false
  }
}

/**
 * Shows the native prompt and says what the customer picked (null when
 * there was nothing to show). A prompt is single-use, so the event is
 * dropped whatever the customer picks — Chrome fires a fresh one when it is
 * willing to ask again.
 */
async function install(): Promise<'accepted' | 'dismissed' | null> {
  const event = deferredPrompt
  if (!event) return null
  setDeferredPrompt(null)
  try {
    await event.prompt()
    return (await event.userChoice).outcome
  } catch {
    // Chrome refuses a prompt outside a user gesture or while another is
    // showing; there is nothing to recover
    return null
  }
}

export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const standalone = isStandalone()
  return {
    /** A native install prompt is ready to show (Chromium). */
    canInstall: event !== null && !standalone,
    install,
    isStandalone: standalone,
    isIos: isIos(),
  }
}
