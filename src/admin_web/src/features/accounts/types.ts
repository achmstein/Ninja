export type TransactionType = 'charge' | 'payment'

export interface AccountTransaction {
  id: number
  type: TransactionType
  amount: number
  description?: string
  // manual, posReceipt, posCreditNote or posTabPayment — and the till's number for the
  // last two, so the label is built in the user's language
  source?: 'manual' | 'posReceipt' | 'posCreditNote' | 'posTabPayment' | string
  sourceNumber?: number | null
  recordedBy: string
  createdAt: string
}

export interface CustomerAccount {
  id: number
  customerId: string
  customerName?: string
  balance: number
  createdAt: string
  updatedAt: string
  transactions: AccountTransaction[]
}

export interface AccountSummary {
  id: number
  customerId: string
  customerName?: string
  balance: number
  updatedAt: string
}

export interface AddChargeRequest {
  amount: number
  description?: string
  customerName?: string
}

export interface RecordPaymentRequest {
  amount: number
  description?: string
}

export interface KeycloakUser {
  id: string
  username: string
  firstName?: string
  lastName?: string
  email?: string
  enabled: boolean
  createdTimestamp: number
}
