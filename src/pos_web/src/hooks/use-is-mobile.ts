import { useSyncExternalStore } from 'react'

/**
 * Below Tailwind's `md` (768px): a phone in the waiter's hand, where the
 * till folds its side panels into sheets. One query, one place — layout that
 * CSS alone can express stays in `max-md:` classes; this is for the few
 * spots that render a different tree (a sheet instead of a side panel).
 */
const PHONE_QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
}
