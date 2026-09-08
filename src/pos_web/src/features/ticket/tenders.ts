import type { TranslationKey } from '@/lib/i18n'

// PaymentTender enum values (Sales.Domain: Cash=0, Card=1, InstaPay=2,
// Account=3).
export type TenderName = 'Cash' | 'Card' | 'InstaPay' | 'Account'

type Tender = {
  value: number
  name: TenderName
  labelKey: TranslationKey
}

export const BASE_TENDERS: readonly Tender[] = [
  { value: 0, name: 'Cash', labelKey: 'cash' },
  { value: 1, name: 'Card', labelKey: 'card' },
  { value: 2, name: 'InstaPay', labelKey: 'instapay' },
]

// Charges a customer's tab (Accounts.API posts the charge off the
// TicketSettled event). Only offered when somebody on the bill or in the
// room can be charged — the server rejects a payment that names no tab.
export const ACCOUNT_TENDER: Tender = {
  value: 3,
  name: 'Account',
  labelKey: 'account',
}

export const tenderLabelKey: Record<string, TranslationKey> = {
  Cash: 'cash',
  Card: 'card',
  InstaPay: 'instapay',
  Account: 'account',
}
