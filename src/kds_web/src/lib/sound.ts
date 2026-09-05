// Alert chime for new-order notifications — the exact sound the mobile apps
// ship (client_app assets/sounds/success.mp3) and the admin board plays, so
// every staff surface rings alike.
//
// Browsers block audio until the page has seen a user interaction; a freshly
// opened till stays silent until the cashier taps anywhere once. Rejections
// are swallowed — the toast still carries the alert.

let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/sounds/success.mp3')
    audio.preload = 'auto'
  }
  return audio
}

/**
 * Play the alert chime `times` times (~700ms apart) — repeats make the
 * escalated order reminders ring rather than politely ping.
 */
export function playAlertSound(times = 1) {
  const el = getAudio()
  let remaining = Math.max(1, times)

  const playOnce = () => {
    remaining -= 1
    el.currentTime = 0
    el.play().catch(() => {
      // Autoplay blocked before first interaction — nothing useful to do
    })
    if (remaining > 0) setTimeout(playOnce, 700)
  }
  playOnce()
}
