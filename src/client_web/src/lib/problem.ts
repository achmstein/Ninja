import type { TranslateParams, TranslationKey } from '@/lib/i18n'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

/**
 * What the server said went wrong, as the code it means it by. Ordering
 * answers every refusal as ProblemDetails with a stable `code` (also its
 * `type`); the app says it in the customer's language from that, never the
 * server's English.
 */
export function problemCode(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (!data || typeof data !== 'object') return null
  const { code, type } = data as { code?: unknown; type?: unknown }
  if (typeof code === 'string' && code) return code
  return typeof type === 'string' && /^[a-z]+\.[a-z_]+$/.test(type) ? type : null
}

export function problemStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}

/** The business no longer has the module this call belonged to */
export function isModuleOff(error: unknown): boolean {
  return problemStatus(error) === 402 || problemCode(error) === 'module.off'
}

/** Each code a customer can meet, as the words for it */
export const PROBLEM_KEYS: Record<string, TranslationKey> = {
  'delivery.not_delivering': 'problemNotDelivering',
  'delivery.out_of_range': 'problemOutOfRange',
  'delivery.below_minimum': 'problemBelowMinimum',
  'delivery.phone_invalid': 'deliveryNeedPhone',
  'delivery.address_required': 'deliveryNeedStreet',
  'delivery.pin_invalid': 'problemPinInvalid',
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
