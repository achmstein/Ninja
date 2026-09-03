import { type LocalizedText } from '@/api/sales'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { ticketTypeKey } from './tender'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

type TicketLike = {
  locationName?: LocalizedText | null
  label?: string | null
  type?: string | null
}

// What identifies a bill: the place it belongs to, or — for a counter tab,
// which has no place — the name the cashier gave it. The kind of place is
// only spelled out when nothing else names it.
export function ticketTitle(
  ticket: TicketLike,
  localized: Localized,
  t: Translate
): string {
  const key = ticketTypeKey(ticket.type)
  return (
    localized(ticket.locationName) ||
    ticket.label ||
    (key ? t(key) : ticket.type || '')
  )
}
