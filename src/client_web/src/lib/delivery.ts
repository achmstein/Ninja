import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import type { CustomerAddressView, DeliveringBranch, DeliveryView } from '@/api/ordering'
import { getDeliveryQuoteOptions, getMyAddressesOptions, resolveDeliveryBranchOptions } from '@/api/ordering/@tanstack/react-query.gen'
import type { BranchResponse } from '@/api/tenant'
import { API_VERSION } from '@/lib/api-client'
import { formatAddressLine, type AddressParts, type AddressWords } from '@/lib/address-line'
import { useAtBranch } from '@/lib/at-branch'
import { useFeatures } from '@/lib/brand'
import { useBranches, useSelectedBranch } from '@/lib/branch'
import type { OrderDestination } from '@/lib/order-destination'
import { GUEST_OWNER, useDeliveryStore, type DeliveryAddress } from '@/stores/delivery-store'

/** What stands in the way of a delivery, for the tray to say */
export type DeliveryProblem = 'signIn' | 'address' | 'checking' | 'quoteFailed' | 'range' | 'minimum' | null

/**
 * Where the order is going when it is brought: what the tray shows and
 * checkout sends. Offered when the branch delivers and the customer is not
 * ordering to a table or a room; then the address is quoted by the branch
 * (in range, the fee, the minimum) and the order can go once it is in range
 * and the dishes reach the minimum.
 */
export type DeliveryState = {
  /** The branch delivers and the order is not for a place in it */
  offered: boolean
  /** Offered and chosen: the order is to be brought */
  active: boolean
  address: DeliveryAddress | null
  /** What the branch adds for bringing it; 0 until quoted */
  fee: number
  minimum: number
  /** How much more the dishes must come to before it can go; 0 when enough */
  short: number
  /** The branch answered for this address */
  quoted: boolean
  inRange: boolean
  /**
   * The branch the address belongs to, when that is not the one the order
   * is at: the order moves there (lib/use-delivery-branch.ts), or, while the
   * customer is at this branch, is offered the move.
   */
  servedBy: { branchId: number; meters: number } | null
  /** Some branch reaches the address; false when none goes that far */
  reached: boolean
  /** The branch the order is to move to now, for the address: servedBy, unless the customer is at this branch */
  moveTo: number | null
  /** Active, addressed, in range and enough: nothing stands in the way */
  ready: boolean
  problem: DeliveryProblem
  /** Ask the branch again, after a quote that never came back */
  retryQuote: () => void
  setWanted: (wanted: boolean) => void
  setAddress: (address: DeliveryAddress | null) => void
}

/**
 * What stands in the way, in the order the customer meets it: a guest where
 * the branch delivers to accounts only, no address, the branch still
 * answering (or not answering at all), too far, too little. Pure, so it is
 * tested apart from the queries.
 */
export function deliveryProblem(s: {
  active: boolean
  /** A guest at a branch that delivers to signed-in customers only: nothing else matters until they sign in */
  needsSignIn?: boolean
  hasAddress: boolean
  quoted: boolean
  quoteFailed: boolean
  inRange: boolean
  short: number
}): DeliveryProblem {
  if (!s.active) return null
  if (s.needsSignIn) return 'signIn'
  if (!s.hasAddress) return 'address'
  if (s.quoteFailed) return 'quoteFailed'
  if (!s.quoted) return 'checking'
  if (!s.inRange) return 'range'
  return s.short > 0 ? 'minimum' : null
}

/**
 * The branch that delivers to an address: the nearest of those the server
 * says reach it that the customer can order from (open, taking orders).
 * The one the order is at already, when it reaches it, is kept only when
 * it is that nearest one: the address, not the last branch, decides.
 */
export function servingBranch(reaching: DeliveringBranch[], branches: BranchResponse[]): { branchId: number; meters: number } | null {
  for (const candidate of reaching) {
    const branch = branches.find((b) => Number(b.id) === Number(candidate.branchId))
    if (branch?.isActive !== false && branch?.isOrderingEnabled !== false && branch != null) {
      return { branchId: Number(candidate.branchId), meters: Number(candidate.distanceMeters) }
    }
  }
  return null
}

/** Whose the delivery choice on this device is: the signed-in account, or the guest */
export function useDeliveryOwner(): string {
  const auth = useAuth()
  return auth.isAuthenticated ? (auth.user?.profile.sub ?? GUEST_OWNER) : GUEST_OWNER
}

export function useDelivery(destination: OrderDestination, subtotal: number): DeliveryState {
  const auth = useAuth()
  const branch = useSelectedBranch()
  const { data: branches = [] } = useBranches()
  const delivers = useFeatures().delivery === true
  const owner = useDeliveryOwner()
  const store = useDeliveryStore()
  const claim = useDeliveryStore((s) => s.claim)
  const { data: saved } = useMyAddresses()

  // The device changed hands (a sign-out, another account): the last one's address goes
  useEffect(() => {
    claim(owner)
  }, [owner, claim])

  // A signed-in customer's address is one of theirs, or none (removed elsewhere, or someone else's)
  const ownersAddress =
    store.owner === owner &&
    store.address != null &&
    (store.address.id == null || saved == null || saved.some((a) => Number(a.id) === store.address?.id))
      ? store.address
      : null

  // The business delivers (an add-on it bought, and on), and so does one of its branches: whichever
  // the order is at now, the address picks the one that brings it
  const offered =
    delivers && !destination && branches.some((b) => b.isActive !== false && b.isDeliveryEnabled === true && b.isOrderingEnabled !== false)
  const active = offered && store.wanted
  // Delivery for signed-in customers only here: a guest is asked to sign in, and nothing is quoted
  const needsSignIn = active && !auth.isAuthenticated && branch?.requireSignInForDelivery === true
  const address = needsSignIn ? null : ownersAddress

  const quoteQuery = useQuery({
    ...getDeliveryQuoteOptions({
      query: { 'api-version': API_VERSION, latitude: address?.latitude ?? 0, longitude: address?.longitude ?? 0 },
    }),
    enabled: active && address != null,
    staleTime: 60_000,
  })
  // Which branches reach the address, asked of no branch in particular
  const resolveQuery = useQuery({
    ...resolveDeliveryBranchOptions({
      query: { 'api-version': API_VERSION, latitude: address?.latitude ?? 0, longitude: address?.longitude ?? 0 },
    }),
    enabled: active && address != null,
    staleTime: 60_000,
  })
  const resolution = address != null ? resolveQuery.data : undefined
  const serving = resolution ? servingBranch(resolution.branches ?? [], branches) : null
  const servedBy = serving && serving.branchId !== Number(branch?.id) ? serving : null
  const reached = resolution == null || serving != null
  // The order follows the address to its branch, unless the customer is at this one (a bill, a hold, a clock)
  const atBranch = useAtBranch()
  const moveTo = active && servedBy != null && !atBranch ? servedBy.branchId : null

  const quote = quoteQuery.data
  // While the order is on its way to the address's branch, this one's answer is not the one that counts
  const quoted = quote != null && address != null && !(resolveQuery.isPending && resolveQuery.isFetching) && moveTo == null
  const inRange = quoted && quote.delivers && quote.inRange
  const fee = quoted ? Number(quote.fee) : 0
  const minimum = quoted ? Number(quote.minimumOrder) : 0
  const short = Math.max(0, minimum - subtotal)
  const problem = deliveryProblem({
    active,
    needsSignIn,
    hasAddress: address != null,
    quoted,
    quoteFailed: quoteQuery.isError && !quoteQuery.isFetching,
    inRange,
    short,
  })

  return {
    offered,
    active,
    address,
    fee: active && inRange ? fee : 0,
    minimum,
    short,
    quoted,
    inRange,
    servedBy,
    reached,
    moveTo,
    ready: active && problem == null,
    problem,
    retryQuote: () => void quoteQuery.refetch(),
    setWanted: store.setWanted,
    setAddress: store.setAddress,
  }
}

/** A signed-in customer's saved addresses, latest first; none for a guest */
export function useMyAddresses() {
  const auth = useAuth()
  const delivers = useFeatures().delivery === true
  return useQuery({
    ...getMyAddressesOptions({ query: { 'api-version': API_VERSION } }),
    enabled: auth.isAuthenticated && delivers,
  })
}

export function fromSaved(saved: CustomerAddressView): DeliveryAddress {
  return {
    id: Number(saved.id),
    label: saved.label,
    latitude: Number(saved.latitude),
    longitude: Number(saved.longitude),
    address: saved.address,
    building: saved.building,
    floor: saved.floor,
    apartment: saved.apartment,
    directions: saved.directions,
    phone: saved.phone,
  }
}

/** The body an address is saved with */
export function addressBody(address: DeliveryAddress) {
  return {
    label: address.label || null,
    latitude: address.latitude,
    longitude: address.longitude,
    address: address.address,
    building: address.building || null,
    floor: address.floor || null,
    apartment: address.apartment || null,
    directions: address.directions || null,
    phone: address.phone || null,
  }
}

/** The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3, Apt 7" */
export function addressLine(address: AddressParts, words: AddressWords, locale: string): string {
  return formatAddressLine(address, words, locale)
}

/** Where a delivered order has got to, for the customer: from the order's delivery as the server sees it */
export type DeliveryStage = 'Waiting' | 'Assigned' | 'OnTheWay' | 'Delivered' | 'Failed' | 'Returned'

export function deliveryStage(delivery: DeliveryView | null | undefined): DeliveryStage | null {
  switch (delivery?.stage) {
    case 'Waiting':
    case 'Assigned':
    case 'OnTheWay':
    case 'Delivered':
    case 'Failed':
    case 'Returned':
      return delivery.stage
    default:
      return null
  }
}
