import type { TranslationKey, useT } from '@/lib/i18n'

type Translate = ReturnType<typeof useT>

/**
 * What the server said went wrong, as the code it means it by. Ordering
 * answers every refusal as ProblemDetails with a stable `code` (also its
 * `type`); the till says it in the cashier's language from that, never the
 * server's English.
 */
export function problemCode(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (!data || typeof data !== 'object') return null
  const { code, type } = data as { code?: unknown; type?: unknown }
  if (typeof code === 'string' && code) return code
  return typeof type === 'string' && /^[a-z]+\.[a-z_]+$/.test(type) ? type : null
}

/** The HTTP status of a failed call, when there was an answer at all */
export function problemStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}

/** The business no longer has the module this call belonged to (the plan or the owner switched it off) */
export function isModuleOff(error: unknown): boolean {
  return problemStatus(error) === 402 || problemCode(error) === 'module.off'
}

/** Each code the till can meet, as the words for it */
export const PROBLEM_KEYS: Record<string, TranslationKey> = {
  'delivery.not_delivering': 'deliveryNotHere',
  'delivery.out_of_range': 'problemOutOfRange',
  'delivery.below_minimum': 'problemBelowMinimum',
  'delivery.phone_invalid': 'deliveryPhoneInvalid',
  'delivery.address_required': 'deliveryNeedsStreet',
  'delivery.pin_invalid': 'problemPinInvalid',
  'delivery.name_required': 'deliveryNeedsName',
  'delivery.place_conflict': 'problemPlaceConflict',
  'delivery.too_long': 'problemTooLong',
  'delivery.not_confirmed': 'problemNotConfirmed',
  'delivery.no_rider': 'problemNoRider',
  'delivery.already_out': 'problemAlreadyOut',
  'delivery.not_out': 'problemNotOut',
  'delivery.not_delivered': 'problemNotDelivered',
  'delivery.already_settled': 'problemAlreadySettled',
  'delivery.conflict': 'problemConflict',
  'delivery.not_delivery': 'problemNotDelivery',
  'delivery.already_delivered': 'problemAlreadyDelivered',
  'delivery.not_failed': 'problemNotFailed',
  'delivery.cash_invalid': 'problemCashInvalid',
  'delivery.not_found': 'problemDeliveryNotFound',
  'rider.unknown': 'problemRiderUnknown',
  'rider.not_yours': 'problemRiderNotYours',
  'module.off': 'problemModuleOff',
  'order.customer_name_required': 'deliveryNeedsName',
  'order.place_closed': 'problemPlaceClosed',
  'order.paused': 'problemPaused',
  'order.validation': 'problemOrderInvalid',
  'order.invalid': 'problemOrderInvalid',
}

/** The words for what went wrong: the code's, else `fallback` (never the server's own text) */
export function problemMessage(error: unknown, t: Translate, fallback: TranslationKey = 'problemGeneric'): string {
  const code = problemCode(error)
  return t((code && PROBLEM_KEYS[code]) || (isModuleOff(error) ? 'problemModuleOff' : fallback))
}
