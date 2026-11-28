import type { DeliveryAlternative, PosDeliveryRequest, StaffDeliveryZone } from '@/api/ordering/types.gen'
import { toNumber } from '@/lib/money'
import { digitCount } from '@/lib/phone'
import type { SaleDelivery, SaleSendTo, SaleZone } from './cart'

/** Enough digits to be a phone the rider can call, and to look a caller up by */
export const MIN_PHONE_DIGITS = 8

/** The longest the server keeps each part (Ordering's DeliveryRules), so a typo is caught before it's sent */
export const DELIVERY_LIMITS = { address: 300, building: 100, floor: 50, apartment: 50, directions: 500 } as const

export type PhoneDeliveryErrors = Partial<Record<'name' | 'phone' | 'address' | 'tooLong', true>>

/** What stands in the way of a delivery the till took over the phone, field by field; empty when nothing does */
export function validatePhoneDelivery(form: SaleDelivery, name: string, needsName: boolean): PhoneDeliveryErrors {
  const errors: PhoneDeliveryErrors = {}
  if (needsName && !name.trim()) errors.name = true
  if (digitCount(form.phone) < MIN_PHONE_DIGITS) errors.phone = true
  if (!form.address.trim()) errors.address = true
  if (
    (Object.keys(DELIVERY_LIMITS) as (keyof typeof DELIVERY_LIMITS)[]).some(
      (k) => form[k].trim().length > DELIVERY_LIMITS[k]
    )
  )
    errors.tooLong = true
  return errors
}

/** The first step of a phone delivery: a number the rider can call, and a name unless the account gives one */
export function validateDeliveryWho(phone: string, name: string, needsName: boolean): PhoneDeliveryErrors {
  const errors: PhoneDeliveryErrors = {}
  if (needsName && !name.trim()) errors.name = true
  if (digitCount(phone) < MIN_PHONE_DIGITS) errors.phone = true
  return errors
}

/** The second step: a street in the caller's words (Google need not know it), nothing longer than the server keeps */
export function validateDeliveryWhere(form: SaleDelivery): PhoneDeliveryErrors {
  const { address, tooLong } = validatePhoneDelivery(form, '', false)
  return { ...(address ? { address } : {}), ...(tooLong ? { tooLong } : {}) }
}

const orNull = (value: string) => value.trim() || null

/**
 * The delivery as the till's order request carries it: the pin only when the
 * caller shared one, the named area only when it is made here (an area is
 * its branch's own)
 */
export function toPosDeliveryRequest(delivery: SaleDelivery): PosDeliveryRequest {
  const pinned = delivery.latitude != null && delivery.longitude != null
  return {
    address: delivery.address.trim(),
    phone: delivery.phone.trim(),
    latitude: pinned ? delivery.latitude : null,
    longitude: pinned ? delivery.longitude : null,
    building: orNull(delivery.building),
    floor: orNull(delivery.floor),
    apartment: orNull(delivery.apartment),
    directions: orNull(delivery.directions),
    zoneId: delivery.sendTo ? null : (delivery.zone?.id ?? null),
    // Where the pin came from, only with one; and the link, so a location shared later lands on the order
    pinSource: pinned ? toPinSource(delivery.pinSource) : null,
    locationShareToken: delivery.locationShareToken || null,
  }
}

/** A pin's source as the order request takes it: None is no pin at all, so a pin without one was searched */
function toPinSource(source: SaleDelivery['pinSource']): Exclude<SaleDelivery['pinSource'], 'None' | null | undefined> {
  return source && source !== 'None' ? source : 'Search'
}

/** A named area the server listed, as the sale keeps it */
export function toSaleZone(zone: {
  zoneId: number | string
  name: { en?: string | null; ar?: string | null }
  fee: number | string
  minimumOrder: number | string
  etaMinutes?: number | string | null
}): SaleZone {
  return {
    id: toNumber(zone.zoneId),
    name: { en: zone.name.en ?? null, ar: zone.name.ar ?? null },
    fee: toNumber(zone.fee),
    minimumOrder: toNumber(zone.minimumOrder),
    etaMinutes: zone.etaMinutes != null ? toNumber(zone.etaMinutes) : null,
  }
}

/** The area with this id in a list the server sent, as the sale keeps it; null when it is not (or no longer) there */
export function zoneIn(
  zones: readonly StaffDeliveryZone[] | null | undefined,
  zoneId: number | string | null | undefined
): SaleZone | null {
  if (zoneId == null) return null
  const found = (zones ?? []).find((z) => toNumber(z.zoneId) === toNumber(zoneId))
  return found ? toSaleZone(found) : null
}

/**
 * The area the sale is charged for: none once it is sent to another branch.
 * The sale pad asks the branch's terms for it, and the fee answered is that
 * area's.
 */
export function chargedZone(delivery: SaleDelivery | null | undefined): SaleZone | null {
  return delivery?.sendTo ? null : (delivery?.zone ?? null)
}

/**
 * Whether the area on the sale is gone from the branch's list: the terms
 * asked for it came back naming another area, or none (the owner removed it).
 */
export function zoneGone(zone: SaleZone | null, answeredZoneId: number | string | null | undefined): boolean {
  return zone != null && (answeredZoneId == null || toNumber(answeredZoneId) !== zone.id)
}

/** A branch the till's quote offered, as the sale keeps it */
export function toSendTo(alternative: DeliveryAlternative): SaleSendTo {
  return {
    branchId: toNumber(alternative.branchId),
    fee: toNumber(alternative.fee),
    minimumOrder: toNumber(alternative.minimumOrder),
    distanceMeters: toNumber(alternative.distanceMeters),
    paused: alternative.paused,
  }
}

/**
 * The branch the delivery goes to, as the quote for the pin now in the form
 * offers it: kept only while the pin stands and that branch is still offered
 * (its fee and pause as they are now), dropped otherwise.
 */
export function keptSendTo(
  sendTo: SaleSendTo | null | undefined,
  alternatives: readonly DeliveryAlternative[] | null | undefined,
  pinned: boolean
): SaleSendTo | null {
  if (!sendTo || !pinned) return null
  const offered = (alternatives ?? []).find((a) => toNumber(a.branchId) === sendTo.branchId)
  return offered ? toSendTo(offered) : null
}

/** The branch that makes the delivery when it is not this one */
export function sendToBranchId(delivery: SaleDelivery | null | undefined): number | null {
  return delivery?.sendTo?.branchId ?? null
}

/** What the delivery adds to the bill: the fee of the branch that delivers it */
export function deliveryFeeOf(delivery: SaleDelivery | null | undefined, hereFee: number): number {
  return delivery?.sendTo ? delivery.sendTo.fee : hereFee
}

/**
 * Whether a sale that is a delivery can be charged as one now. It is the
 * cart that says it is a delivery; the branch's terms only say whether it can
 * go: while they are being read, if they couldn't be, or if the branch (or
 * the business) no longer delivers, the sale waits rather than going out as a
 * counter sale.
 */
export type DeliveryReadiness = 'none' | 'ready' | 'loading' | 'failed' | 'off'

export function deliveryReadiness(
  delivery: SaleDelivery | null,
  terms: { isLoading: boolean; isError: boolean; delivers: boolean | undefined },
  featureOn: boolean
): DeliveryReadiness {
  if (delivery == null) return 'none'
  if (!featureOn) return 'off'
  if (terms.isLoading) return 'loading'
  if (terms.isError) return 'failed'
  return terms.delivers ? 'ready' : 'off'
}
