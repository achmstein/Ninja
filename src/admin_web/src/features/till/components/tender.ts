import { type TranslationKey } from '@/lib/i18n'

// PaymentTender as Sales.Domain numbers it (Cash=0, Card=1, InstaPay=2,
// Account=3). Query params take the number; the read models spell the name.
type TenderName = 'Cash' | 'Card' | 'InstaPay' | 'Account'

export const TENDERS: {
  name: TenderName
  value: number
  labelKey: TranslationKey
}[] = [
  { name: 'Cash', value: 0, labelKey: 'tenderCash' },
  { name: 'Card', value: 1, labelKey: 'tenderCard' },
  { name: 'InstaPay', value: 2, labelKey: 'tenderInstaPay' },
  { name: 'Account', value: 3, labelKey: 'tenderOnAccount' },
]

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
