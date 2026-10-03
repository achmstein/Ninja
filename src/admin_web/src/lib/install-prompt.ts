import { useSyncExternalStore } from 'react'

/** The browser's offer to install the app, held until someone takes it */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let offer: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/**
 * Listens for the offer from the first moment (call once at start-up, before
 * the browser makes it); an installed app makes no offer.
 */
export function listenForInstallOffer() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    offer = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    notify()
  })
}

/** Whether the app can be installed now, and the way to do it */
export function useInstallApp(): { canInstall: boolean; install: () => void } {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => offer
  )
  return {
    canInstall: current !== null,
    install: () => {
      if (!offer) return
      void offer.prompt()
      void offer.userChoice.then(() => {
        offer = null
        notify()
      })
    },
  }
}
