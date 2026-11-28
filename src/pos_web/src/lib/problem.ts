import { isModuleOff, problemCode } from '@ninja/web-core/problem'
import type { TranslationKey, useT } from '@/lib/i18n'

type Translate = ReturnType<typeof useT>

export { isModuleOff, problemCode, problemStatus } from '@ninja/web-core/problem'

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
  'delivery.send_not_delivery': 'problemSendNotDelivery',
  'delivery.send_with_ticket': 'problemSendWithTicket',
  'delivery.send_branch_closed': 'problemSendBranchClosed',
  'delivery.area_unknown': 'deliveryAreaGone',
  'delivery.area_off': 'problemAreaOff',
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
