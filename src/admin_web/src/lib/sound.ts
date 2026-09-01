// Alert chime for admin notifications — the exact sound the mobile apps ship
// (client_app assets/sounds/success.mp3), so web and app alerts sound alike.
//
// Browsers block audio until the page has seen a user interaction; a freshly
// opened tab stays silent until the admin clicks anywhere once. Rejections
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
