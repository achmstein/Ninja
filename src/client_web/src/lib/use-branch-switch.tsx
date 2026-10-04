import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type BranchResponse } from '@/api/tenant'
import { isOpen, useMyBills } from '@/lib/bills'
import { lastUsedFirst, useBranches } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { byDistance, pointOf, useMyLocation } from '@/lib/geo'
import { useLocalized, useT } from '@/lib/i18n'
import { useActiveStay, useMyHold } from '@/lib/stays'
import { useBranchStore } from '@/stores/branch-store'
import { useActivePlace, usePlaceStore } from '@/stores/place-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Moving the app to another branch: the branch is set, the scanned place
 * and the order go (the other branch's menu is not this one's), and
 * everything on screen, all of it branch-scoped, is fetched again. With
 * dishes in the order it asks first. `then` runs once the switch is made
 * (at once, or after the yes), never on a no.
 */
export function useBranchSwitch() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  const lines = useCart((s) => s.lines)
  const clearCart = useCart((s) => s.clear)
  const { data: branches = [] } = useBranches()
  // A switch asked for with dishes in the order, waiting for the answer
  const [pending, setPending] = useState<{ id: number; then?: () => void } | null>(null)

  const switchTo = useCallback(
    (id: number) => {
      setBranchId(id)
      clearPlace()
      clearCart()
      // Everything on screen is branch-scoped — refetch it all
      queryClient.invalidateQueries()
    },
    [setBranchId, clearPlace, clearCart, queryClient]
  )

  const request = (id: number, then?: () => void) => {
    if (id === branchId) {
      then?.()
      return
    }
    if (lines.length > 0) {
      setPending({ id, then })
      return
    }
    switchTo(id)
    then?.()
  }

  const pendingBranch = branches.find((b) => Number(b.id) === pending?.id)
  const dialog = (
    <AlertDialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('ninjaSwitchBranchWithOrder', { name: localized(pendingBranch?.name) })}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('ninjaKeepOrder')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pending) {
                switchTo(pending.id)
                pending.then?.()
              }
              setPending(null)
            }}
          >
            {t('ninjaSwitchBranch')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { request, dialog }
}

/**
 * The branches with how far each is, closest first once the customer's
 * position is known, else the one used last and then the owner's order.
 * `ask`: the list is on screen and worth measuring, so the browser may ask
 * for the position (once a session).
 */
export function useBranchesByDistance(ask: boolean, list?: BranchResponse[]) {
  const branchId = useBranchStore((s) => s.branchId)
  const { data: all = [] } = useBranches()
  const branches = list ?? all
  const anyPoint = branches.filter((b) => pointOf(b)).length > 0
  const location = useMyLocation(ask && branches.length > 1 && anyPoint)
  const sorted = byDistance(lastUsedFirst(branches, branchId), location.here, pointOf)
  return { sorted, location, anyPoint }
}

/** Whether the customer is at the branch: an open bill, a held place, a running clock or a scanned table */
export function useAtBranch(): boolean {
  const { data: bills = [] } = useMyBills()
  const hold = useMyHold()
  const stay = useActiveStay()
  const place = useActivePlace()
  return bills.some(isOpen) || hold != null || stay != null || place != null
}
