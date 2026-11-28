import { isModuleOff, problemCode } from '@ninja/web-core/problem'
import type { TranslateParams, TranslationKey } from '@/lib/i18n'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

export { isModuleOff, problemCode, problemStatus } from '@ninja/web-core/problem'

/** Each code a customer can meet, as the words for it */
export const PROBLEM_KEYS: Record<string, TranslationKey> = {
  'delivery.not_delivering': 'problemNotDelivering',
  'delivery.out_of_range': 'problemOutOfRange',
  'delivery.area_off': 'problemAreaOff',
  'delivery.below_minimum': 'problemBelowMinimum',
  'delivery.phone_invalid': 'deliveryNeedPhone',
  'delivery.address_required': 'deliveryNeedStreet',
  'delivery.pin_invalid': 'problemPinInvalid',
  'delivery.sign_in_required': 'deliveryNeedsAccount',
  'delivery.place_conflict': 'problemPlaceConflict',
  'delivery.too_long': 'problemTooLong',
  'address.limit': 'problemAddressLimit',
  'address.not_found': 'problemAddressGone',
  'module.off': 'problemNotDelivering',
  'order.guest_name_required': 'problemGuestName',
  'order.guest_phone_invalid': 'deliveryNeedPhone',
  'order.guest_needs_place': 'problemGuestNeedsPlace',
  'order.guest_waiting': 'orderStillWaiting',
  'order.guest_blocked': 'problemGuestBlocked',
  'order.sign_in_required': 'problemSignInRequired',
  'order.place_closed': 'problemPlaceClosed',
  'order.paused': 'problemPaused',
  'order.points_need_account': 'problemSignInRequired',
  'order.validation': 'failedToPlaceOrder',
  'order.invalid': 'failedToPlaceOrder',
}

/** The words for what went wrong: the code's, else `fallback` (never the server's own text) */
export function problemMessage(error: unknown, t: Translate, fallback: TranslationKey): string {
  const code = problemCode(error)
  return t((code && PROBLEM_KEYS[code]) || (isModuleOff(error) ? 'problemNotDelivering' : fallback))
}
