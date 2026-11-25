import { type TranslationKey } from '@/lib/i18n'

// PaymentTender as Sales.Domain numbers it (Cash=0, Card=1, InstaPay=2,
// Account=3, Online=4, Talabat=5). Query params take the number; the read
// models spell the name. Online is what guests paid from their phones (online
// payments); Talabat is a Talabat order Talabat pays the business for, settled
// when it lands. Neither is cash, neither is in the drawer.
export type TenderName =
  | 'Cash'
  | 'Card'
  | 'InstaPay'
  | 'Account'
  | 'Online'
  | 'Talabat'
  | 'Courier'

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
  { name: 'Talabat', value: 5, labelKey: 'tenderTalabat' },
  // A courier company's delivery: its courier collected and the company owes
  // the business; settled by the server, never cash
  { name: 'Courier', value: 6, labelKey: 'tenderCourier' },
]

/** The modules a tender belongs to (see useModules); cash, card and InstaPay belong to none */
export type TenderModules = {
  onlinePayments?: boolean
  tabs?: boolean
  talabat?: boolean
  couriers?: boolean
}

/**
 * The tenders worth offering: each one whose module the business runs, and
 * any that was used anyway (a module switched off since keeps its history).
 * On account is the tabs module, Online is online payments, Talabat and
 * Courier their connections.
 */
export function tendersFor(
  modules: TenderModules,
  used: Iterable<TenderName> = []
) {
  const usedNames = new Set(used)
  const on: Record<TenderName, boolean> = {
    Cash: true,
    Card: true,
    InstaPay: true,
    Account: modules.tabs === true,
    Online: modules.onlinePayments === true,
    Talabat: modules.talabat === true,
    Courier: modules.couriers === true,
  }
  return TENDERS.filter(
    (tender) => on[tender.name] || usedNames.has(tender.name)
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
