import { useCallback, useEffect, useRef, useState } from 'react'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { type BranchResponse } from '@/api/tenant'
import { lastUsedFirst, useBranches } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { byDistance, type LatLng, pointOf, useMyLocation } from '@/lib/geo'
import { useLocalized, useT } from '@/lib/i18n'
import { moveLines, type OrderMove } from '@/lib/order-move'
import { toast } from '@/lib/toast'
import { useHandler } from '@/lib/use-handler'
import { useBranchStore } from '@/stores/branch-store'
import { usePlaceStore } from '@/stores/place-store'

/**
 * Moving the app to another branch, the order with it: the branch is set
 * and everything on screen, all of it branch-scoped, is fetched again; the
 * dishes stay, at the new branch's prices, and one it does not serve goes
 * (lib/order-move.ts), `onMoved` told what changed. Nothing asks: the
 * customer loses nothing they could still have.
 */
export function moveToBranch(queryClient: QueryClient, branchId: number, onMoved?: (move: OrderMove) => void) {
  useBranchStore.getState().setBranchId(branchId)
  queryClient.invalidateQueries()
  if (useCart.getState().lines.length === 0) return
  queryClient
    .fetchQuery({ ...listItemsOptions({ headers: { 'X-Branch-Id': String(branchId) } }), staleTime: 0 })
    .then((menu) => {
      // Moved again meanwhile: that move carries the order
      if (useBranchStore.getState().branchId !== branchId) return
      const move = moveLines(useCart.getState().lines, menu)
      if (move.dropped.length === 0 && move.repriced.length === 0) return
      useCart.getState().setLines(move.lines)
      onMoved?.(move)
    })
    // The menu could not be had: the order goes as it is, and the branch's own check of it says what is off
    .catch(() => {})
}

/** What the customer is told of an order that moved: only what changed in it */
export function useSayOrderMoved() {
  const t = useT()
  const localized = useLocalized()
  const { data: branches = [] } = useBranches()
  return useCallback(
    (branchId: number, move: OrderMove) => {
      const name = localized(branches.find((b) => Number(b.id) === branchId)?.name)
      if (move.dropped.length > 0) {
        const dishes = move.dropped.map((l) => localized({ en: l.nameEn, ar: l.nameAr })).join(' · ')
        toast.warning(t('orderMovedDropped', { name, dishes }))
      } else if (move.repriced.length > 0) {
        toast.info(t('orderMovedRepriced', { name }))
      }
    },
    [t, localized, branches]
  )
}

/**
 * The branch the app opens at, without asking the customer anything: the
 * one last used; on a first visit (or where that branch is gone) the first
 * open one taking orders in the owner's order, then, where the browser
 * already gives the position without a prompt, the nearest open one. What
 * was fetched for the wrong one is fetched again. The menu is the same
 * everywhere, so a guess costs nothing: a delivery address or a booking
 * moves the app, the order with it, to the branch that counts.
 * Mounted once, at the root.
 */
export function useBranchFallback() {
  const queryClient = useQueryClient()
  const { branchId, chosen, setBranchId } = useBranchStore()
  const { data: branches } = useBranches()
  // Decided once, at launch: a later visit keeps its branch, wherever the customer is
  const [firstVisit] = useState(() => !useBranchStore.getState().chosen)
  const { here } = useMyLocation(firstVisit && (branches?.length ?? 0) > 1, { quiet: true })

  useEffect(() => {
    if (!branches?.length) return
    if (chosen && branches.some((b) => Number(b.id) === branchId)) return
    const ordered = lastUsedFirst(branches, branchId)
    const first = ordered.find((b) => b.isActive && b.isOrderingEnabled) ?? ordered.find((b) => b.isActive) ?? ordered[0]
    setBranchId(Number(first.id))
    queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as { _id?: string } | undefined)?._id !== 'getBranches' })
  }, [branches, branchId, chosen, setBranchId, queryClient])

  const placed = useRef(false)
  useEffect(() => {
    if (!firstVisit || !here || !branches?.length || placed.current) return
    placed.current = true
    moveToNearest(queryClient, branches, here)
  }, [firstVisit, here, branches, queryClient])
}

/**
 * The app to the nearest open branch taking orders, the order with it; the branch it went to, or
 * null where it stayed (already the nearest, or no branch has a point). Twice in a row (the first
 * visit's quiet look and the customer's own "Use my location") moves once: the branch is set at once.
 */
export function moveToNearest(
  queryClient: QueryClient,
  branches: BranchResponse[],
  here: LatLng,
  onMoved?: (move: OrderMove) => void
): { branch: BranchResponse; meters: number } | null {
  const open = branches.filter((b) => b.isActive && b.isOrderingEnabled)
  const nearest = byDistance(open, here, pointOf)[0]
  if (nearest?.meters == null || Number(nearest.item.id) === useBranchStore.getState().branchId) return null
  moveToBranch(queryClient, Number(nearest.item.id), onMoved)
  return { branch: nearest.item, meters: nearest.meters }
}

/** The order going where the address is served from, once that is known (lib/delivery.ts's `moveTo`) */
export function useOrderFollowsAddress(branchId: number | null) {
  const queryClient = useQueryClient()
  const say = useHandler(useSayOrderMoved())
  useEffect(() => {
    if (branchId == null) return
    moveToBranch(queryClient, branchId, (move) => say(branchId, move))
  }, [branchId, queryClient, say])
}

/**
 * The customer moving to another branch (the branch sheet, booking there,
 * a delivery from there): the scanned place goes, the order comes along.
 * `then` runs once the switch is made.
 */
export function useBranchSwitch() {
  const queryClient = useQueryClient()
  const branchId = useBranchStore((s) => s.branchId)
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  const say = useSayOrderMoved()

  const request = (id: number, then?: () => void) => {
    if (id !== branchId) {
      clearPlace()
      moveToBranch(queryClient, id, (move) => say(id, move))
    }
    then?.()
  }

  return { request }
}

/**
 * The branches with how far each is, closest first once the customer's
 * position is known, else the one used last and then the owner's order.
 * `ask`: the list is on screen and worth measuring, so a position the
 * browser already gives is read; nothing prompts for one, the customer's
 * "Use my location" does.
 */
export function useBranchesByDistance(ask: boolean, list?: BranchResponse[]) {
  const branchId = useBranchStore((s) => s.branchId)
  const { data: all = [] } = useBranches()
  const branches = list ?? all
  const anyPoint = branches.filter((b) => pointOf(b)).length > 0
  const location = useMyLocation(ask && branches.length > 1 && anyPoint, { quiet: true })
  const sorted = byDistance(lastUsedFirst(branches, branchId), location.here, pointOf)
  return { sorted, location, anyPoint }
}

export { useAtBranch } from '@/lib/at-branch'
