import type { PosDeliveryRequest } from '@/api/ordering/types.gen'
import { digitCount } from '@/lib/phone'
import type { SaleDelivery } from './cart'

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
  if ((Object.keys(DELIVERY_LIMITS) as (keyof typeof DELIVERY_LIMITS)[]).some((k) => form[k].trim().length > DELIVERY_LIMITS[k]))
    errors.tooLong = true
  return errors
}

const orNull = (value: string) => value.trim() || null

/** The delivery as the till's order request carries it: the pin only when the caller shared one */
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
  }
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
  featureOn: boolean,
): DeliveryReadiness {
  if (delivery == null) return 'none'
  if (!featureOn) return 'off'
  if (terms.isLoading) return 'loading'
  if (terms.isError) return 'failed'
  return terms.delivers ? 'ready' : 'off'
}
