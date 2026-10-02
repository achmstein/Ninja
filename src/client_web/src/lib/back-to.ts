import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

/** Set as the guest leaves a paid (or settled) payment for the bills, read once by the bills page. */
const AFTER_PAYMENT = 'ninja:after-payment'

/** The bills are opened from a payment's outcome: their back goes to the menu, not to the outcome again. */
export function markAfterPayment() {
  try {
    sessionStorage.setItem(AFTER_PAYMENT, '1')
  } catch {
    // Private mode: back keeps the browser's own way
  }
}

/** Whether the page was opened from a payment's outcome; asked once, the mark goes with it. */
export function takeAfterPayment(): boolean {
  try {
    const was = sessionStorage.getItem(AFTER_PAYMENT) === '1'
    sessionStorage.removeItem(AFTER_PAYMENT)
    return was
  } catch {
    return false
  }
}

/**
 * The browser's back goes to `to` from this page, rather than to whatever the
 * history holds behind it: after a payment that is the outcome page, and
 * behind that the provider's checkout, neither of which anyone means to see
 * again. The page is put in the history twice; the back that takes the copy
 * off is caught and becomes a move to `to` in its place.
 */
export function useBackTo(to: '/' | '/bills', enabled: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    window.history.pushState(window.history.state, '', window.location.href)
    const onBack = () => void router.navigate({ to, replace: true })
    window.addEventListener('popstate', onBack, { once: true })
    return () => window.removeEventListener('popstate', onBack)
  }, [enabled, to, router])
}
