import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LocateFixed, Loader2, MapPinned } from 'lucide-react'
import { useAtBranch } from '@/lib/at-branch'
import { useBranches } from '@/lib/branch'
import { pointOf, useDistance, useLocationPermission, useMyLocation } from '@/lib/geo'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { moveToNearest, useSayOrderMoved } from '@/lib/use-branch-switch'
import { useDeliveryStore } from '@/stores/delivery-store'
import { pillAction, pillCancel, sheetFooterClass } from '@/components/ui/ninja-sheet'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/** When the customer last said "Not now": not asked again for a fortnight */
const SNOOZE_KEY = 'ninja-location-primer'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
/** Asked once the menu has settled, not over its first paint */
const SETTLE_MS = 1200

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) ?? 0)
    return Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  } catch {
    // Storage blocked (a private window): asked again next visit, which is no worse than before
  }
}

/**
 * Before the browser asks for the position, the app says why: a business with branches in more than
 * one place orders from the nearest when it knows where the customer is. The browser's own prompt can
 * be answered once (a no is remembered for the site), so it is shown only after the customer chose
 * "Use my location" here. Not shown where the browser would not ask (already given, or refused), at a
 * business with one branch, to a customer at a branch (a bill, a hold, a clock, a table), or within a
 * fortnight of a "Not now". The branches, booking and the pickup row keep "Use my location" for later.
 */
export function NearestBranchPrimer() {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const queryClient = useQueryClient()
  const { data: branches = [] } = useBranches()
  const atBranch = useAtBranch()
  const permission = useLocationPermission()
  const location = useMyLocation(false)
  const say = useSayOrderMoved()
  const [open, setOpen] = useState(false)
  // Once a page load, whatever the answer
  const asked = useRef(false)
  // The customer chose to share: the fix that comes back moves the app
  const wanted = useRef(false)

  const placed = branches.filter((b) => b.isActive && pointOf(b))
  const worth = placed.length > 1 && !atBranch && !location.here && (permission === 'prompt' || permission === null)

  useEffect(() => {
    if (!worth || asked.current || snoozed()) return
    const timer = window.setTimeout(() => {
      asked.current = true
      setOpen(true)
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [worth])

  // The position came: to the nearest open branch, said once
  useEffect(() => {
    if (!wanted.current || !location.here) return
    wanted.current = false
    setOpen(false)
    // Brought to an address: the address picks the branch, not where the customer stands
    const { wanted: delivering, address } = useDeliveryStore.getState()
    if (delivering && address) return
    const moved = moveToNearest(queryClient, branches, location.here, (move) => say(Number(moved?.branch.id), move))
    if (moved) toast.success(t('nearestBranchMoved', { name: localized(moved.branch.name), distance: distance(moved.meters) }))
  }, [location.here, branches, queryClient, say, t, localized, distance])

  // Refused at the browser's own prompt: said, and the sheet goes
  useEffect(() => {
    if (wanted.current && permission === 'denied') {
      wanted.current = false
      setOpen(false)
      toast.info(t('nearestBranchBlocked'))
    }
  }, [permission, t])

  const later = () => {
    snooze()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : later())}>
      <SheetContent>
        <SheetHeader className='items-center px-6 text-center'>
          <span className='bg-primary/10 text-primary mb-1 grid size-14 place-items-center rounded-full'>
            <MapPinned className='size-7' />
          </span>
          <SheetTitle>{t('nearestBranchTitle')}</SheetTitle>
          <SheetDescription>{t('nearestBranchBody')}</SheetDescription>
        </SheetHeader>
        <div className={sheetFooterClass}>
          <button type='button' onClick={later} className={pillCancel}>
            {t('notNow')}
          </button>
          <button
            type='button'
            disabled={location.locating}
            onClick={() => {
              wanted.current = true
              location.locate()
            }}
            className={pillAction}
          >
            {location.locating ? <Loader2 className='size-5 animate-spin' /> : <LocateFixed className='size-5' />}
            {location.locating ? t('locating') : t('useMyLocation')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
