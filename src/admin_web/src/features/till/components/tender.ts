import { type TranslationKey } from '@/lib/i18n'

// PaymentTender as Sales.Domain numbers it (Cash=0, Card=1, InstaPay=2,
// Account=3, Online=4). Query params take the number; the read models spell
// the name. Online is what guests paid from their phones (online payments):
// never cash, never in the drawer.
type TenderName = 'Cash' | 'Card' | 'InstaPay' | 'Account' | 'Online'

export const TENDERS: {
  name: TenderName
  value: number
  labelKey: TranslationKey
}[] = [
  { name: 'Cash', value: 0, labelKey: 'tenderCash' },
  { name: 'Card', value: 1, labelKey: 'tenderCard' },
  { name: 'InstaPay', value: 2, labelKey: 'tenderInstaPay' },
  { name: 'Account', value: 3, labelKey: 'tenderOnAccount' },
  { name: 'Online', value: 4, labelKey: 'tenderOnline' },
]

/**
 * The tenders worth offering: Online only where the café takes payments at
 * the table, or where some was taken anyway (switched off since).
 */
export function tendersFor(onlinePayments: boolean | undefined, hasOnline = false) {
  return TENDERS.filter(
    (tender) => tender.name !== 'Online' || onlinePayments || hasOnline
  )
}

export function tenderLabelKey(
  name: string | null | undefined
): TranslationKey | undefined {
  return TENDERS.find((tender) => tender.name === name)?.labelKey
}

// TicketType names as the read models spell them: the plural label the
// report groups by, and the singular a table cell wants
export const TICKET_TYPES: {
  name: string
  labelKey: TranslationKey
  singularKey: TranslationKey
}[] = [
  { name: 'Room', labelKey: 'ticketTypeRoom', singularKey: 'ticketRoom' },
  { name: 'Table', labelKey: 'ticketTypeTable', singularKey: 'ticketTable' },
  {
    name: 'Counter',
    labelKey: 'ticketTypeCounter',
    singularKey: 'ticketCounter',
  },
]

export function ticketTypeKey(
  name: string | null | undefined
): TranslationKey | undefined {
  return TICKET_TYPES.find((type) => type.name === name)?.singularKey
}

// TicketStatus as Sales.Domain numbers it (Open=0, Settled=1, Voided=2)
export const TICKET_STATUS_SETTLED = 1
export const TICKET_STATUS_VOIDED = 2

export const ticketStatusKey: Record<string, TranslationKey> = {
  Open: 'statusOpen',
  Settled: 'statusSettled',
  Voided: 'statusVoided',
}
