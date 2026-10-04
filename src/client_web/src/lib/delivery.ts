import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import type { CustomerAddressView, DeliveryView } from '@/api/ordering'
import { getDeliveryQuoteOptions, getMyAddressesOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useSelectedBranch } from '@/lib/branch'
import type { OrderDestination } from '@/lib/order-destination'
import { useDeliveryStore, type DeliveryAddress } from '@/stores/delivery-store'

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
  /** Active, addressed, in range and enough: nothing stands in the way */
  ready: boolean
  /** What stands in the way, for the tray to say */
  problem: 'address' | 'range' | 'minimum' | 'checking' | null
  setWanted: (wanted: boolean) => void
  setAddress: (address: DeliveryAddress | null) => void
}

export function useDelivery(destination: OrderDestination, subtotal: number): DeliveryState {
  const branch = useSelectedBranch()
  const { wanted, address, setWanted, setAddress } = useDeliveryStore()
  const offered = !destination && branch?.isDeliveryEnabled === true && branch.isOrderingEnabled !== false
  const active = offered && wanted

  const quoteQuery = useQuery({
    ...getDeliveryQuoteOptions({
      query: { 'api-version': API_VERSION, latitude: address?.latitude ?? 0, longitude: address?.longitude ?? 0 },
    }),
    enabled: active && address != null,
    staleTime: 60_000,
  })
  const quote = quoteQuery.data
  const quoted = quote != null && address != null
  const inRange = quoted && quote.delivers && quote.inRange
  const fee = quoted ? Number(quote.fee) : 0
  const minimum = quoted ? Number(quote.minimumOrder) : 0
  const short = Math.max(0, minimum - subtotal)

  const problem: DeliveryState['problem'] = !active
    ? null
    : !address
      ? 'address'
      : !quoted
        ? 'checking'
        : !inRange
          ? 'range'
          : short > 0
            ? 'minimum'
            : null

  return {
    offered,
    active,
    address,
    fee: active && inRange ? fee : 0,
    minimum,
    short,
    quoted,
    inRange,
    ready: active && problem == null,
    problem,
    setWanted,
    setAddress,
  }
}

/** A signed-in customer's saved addresses, latest first; none for a guest */
export function useMyAddresses() {
  const auth = useAuth()
  return useQuery({
    ...getMyAddressesOptions({ query: { 'api-version': API_VERSION } }),
    enabled: auth.isAuthenticated,
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

/** The address on one line, the street first: "Tahrir St · Bldg 12, floor 3, apt 7" */
export function addressLine(
  address: Pick<DeliveryAddress, 'address' | 'building' | 'floor' | 'apartment'>,
  words: { building: string; floor: string; apartment: string }
): string {
  const parts = [
    address.building ? `${words.building} ${address.building}` : null,
    address.floor ? `${words.floor} ${address.floor}` : null,
    address.apartment ? `${words.apartment} ${address.apartment}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? `${address.address} · ${parts.join('، ')}` : address.address
}

/** Where a delivered order has got to, for the customer: from the order's delivery as the server sees it */
export type DeliveryStage = 'Waiting' | 'Assigned' | 'OnTheWay' | 'Delivered'

export function deliveryStage(delivery: DeliveryView | null | undefined): DeliveryStage | null {
  const stage = delivery?.stage
  return stage === 'Waiting' || stage === 'Assigned' || stage === 'OnTheWay' || stage === 'Delivered' ? stage : null
}
