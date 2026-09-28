import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useBrandName } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { island } from '@/lib/island'
import { useOrderPill } from '@/lib/order-pill'
import { useInstallAction } from './use-install-action'

const VISITS_KEY = 'ninja-install-visits'
const NUDGED_KEY = 'ninja-install-nudged'
const SESSION_KEY = 'ninja-install-counted'

/** How many times the island offers it on this browser, at most */
const MAX_NUDGES = 2
/** A visit this many or more (or a first order placed) earns the offer */
const VISITS_BEFORE = 2
/** Let the page settle first, so the offer never lands with the first paint, ms */
const DELAY_MS = 5000
/** How long the island holds the offer, ms */
const HOLD_MS = 9000

function read(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0
  } catch {
    return MAX_NUDGES
  }
}

function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Storage blocked: the offer simply does not count, and does not come
  }
}

/** Counts this visit once per session, and says how many there have been */
function countVisit(): number {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return read(VISITS_KEY)
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    return 0
  }
  const visits = read(VISITS_KEY) + 1
  write(VISITS_KEY, visits)
  return visits
}

/**
 * The offer to install, said by the island a moment into a second visit or
 * after a first order, with an Install button on it: at most twice on a
 * browser, and never once installed. The You page keeps a row for it for
 * anyone who let it go by. Mount once, in the root.
 */
export function InstallNudge() {
  const t = useT()
  const brandName = useBrandName()
  const { eligible, run, dialog } = useInstallAction()
  const ordered = useOrderPill((s) => s.placedAt != null)
  const [visits] = useState(countVisit)
  const due = eligible && read(NUDGED_KEY) < MAX_NUDGES && (visits >= VISITS_BEFORE || ordered)

  useEffect(() => {
    if (!due) return
    const timer = window.setTimeout(() => {
      write(NUDGED_KEY, read(NUDGED_KEY) + 1)
      island.flash(
        {
          type: 'info',
          title: t('installAppTitle', { name: brandName }),
          description: t('installAppSubtitle'),
          icon: <Download className='size-3.5' />,
          button: { title: t('install'), onClick: run },
        },
        HOLD_MS
      )
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
    // Once per page view: when it became due, not every render after
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due])

  return dialog
}
