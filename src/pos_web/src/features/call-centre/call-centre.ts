// The pure parts of the call centre: which branch a caller's delivery goes to,
// and what the sale is made of once it is chosen. Kept apart from the screens
// so they can be tested.
import type { DeliveryAlternative, StaffDeliveryZone } from '@/api/ordering/types.gen'
import { toNumber } from '@/lib/money'
import type { SaleDelivery } from '@/features/sale/cart'

/**
 * The delivery as the sale pad keeps it, at the branch that makes it: the
 * caller's words, the named area the agent picked (on the form), and the pin
 * read from what they shared. Never sent on to another branch — the till
 * switches to the branch that cooks it.
 */
export function callerDelivery(form: SaleDelivery, pin: { latitude: number; longitude: number } | null): SaleDelivery {
  return {
    ...form,
    address: form.address.trim(),
    latitude: pin?.latitude ?? null,
    longitude: pin?.longitude ?? null,
    // The pin as coordinates: the sale pad's quote reads it back as the same point
    location: pin ? `${pin.latitude}, ${pin.longitude}` : form.location.trim(),
    sendTo: null,
    zone: form.zone ?? null,
  }
}

/** The named area with this id among every branch's, as the server lists them now; null when it is not there */
export function areaById(zones: readonly StaffDeliveryZone[], zoneId: number | null): StaffDeliveryZone | null {
  if (zoneId == null) return null
  return zones.find((z) => toNumber(z.zoneId) === zoneId) ?? null
}

/**
 * The named area the point on the map is in at this branch, when it is in
 * one: what the order is charged there unless the agent picks another by name.
 */
export function pinArea(
  reaching: readonly DeliveryAlternative[],
  zones: readonly StaffDeliveryZone[],
  branchId: number | null
): StaffDeliveryZone | null {
  if (branchId == null) return null
  const at = reaching.find((b) => toNumber(b.branchId) === branchId)
  if (at?.zoneId == null) return null
  const zone = areaById(zones, toNumber(at.zoneId))
  return zone && toNumber(zone.branchId) === branchId ? zone : null
}

/**
 * The area the order goes to: the one the agent picked by name while it is
 * still listed; otherwise the one the map point is in, unless it is switched
 * off (that takes the agent's own tap) or the agent took it off.
 */
export function chosenArea(
  zones: readonly StaffDeliveryZone[],
  byName: number | null,
  onMap: StaffDeliveryZone | null,
  tookOff: boolean
): StaffDeliveryZone | null {
  const named = areaById(zones, byName)
  if (named) return named
  return onMap && onMap.on && !tookOff ? onMap : null
}

/** A branch the agent may send the caller's order to. No distance when no point on the map is known. */
export type BranchOffer = { branchId: number; fee: number; distanceMeters: number | null; paused: boolean }

type Delivering = { branchId: number | string; fee: number | string; paused: boolean }

/**
 * What the agent chooses from. With a point on the map that some branch's
 * area takes in: those branches, nearest first, and the nearest open one is
 * suggested. Otherwise (the caller only said where they live, or the point is
 * outside every area) every branch that delivers, picked by hand: the agent
 * hears "Maadi" and knows which branch that is.
 */
export function branchOffers(
  reaching: readonly DeliveryAlternative[],
  delivering: readonly Delivering[]
): { offers: BranchOffer[]; byHand: boolean } {
  if (reaching.length > 0) {
    return {
      byHand: false,
      offers: reaching.map((b) => ({
        branchId: toNumber(b.branchId),
        fee: toNumber(b.fee),
        distanceMeters: toNumber(b.distanceMeters),
        paused: b.paused,
      })),
    }
  }
  return {
    byHand: true,
    offers: delivering.map((b) => ({
      branchId: toNumber(b.branchId),
      fee: toNumber(b.fee),
      distanceMeters: null,
      paused: b.paused,
    })),
  }
}

/**
 * The branch the order goes to. The agent's own pick while it is still
 * offered. Without one: the nearest open branch when the map chose, and when
 * picking by hand only a business's single open branch, since any other
 * choice would be a guess.
 */
export function offeredBranch(offers: readonly BranchOffer[], byHand: boolean, picked: number | null): number | null {
  if (picked != null && offers.some((b) => b.branchId === picked)) return picked
  if (!byHand) return offers.find((b) => !b.paused)?.branchId ?? null
  return offers.length === 1 && !offers[0].paused ? offers[0].branchId : null
}
