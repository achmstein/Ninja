import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { digitCount } from '@/lib/phone'
import { normalizeName } from '@/lib/names'

// Customers the till adds by name and phone (Identity.API's
// CounterCustomersApi). No generated SDK: Identity proxies Keycloak and has
// no OpenAPI document, so these go through the shared axios client like the
// customer search does.

/** A customer as Identity returns them. */
export type IdentityCustomer = {
  id: string
  username?: string | null
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
  /** Added at the till and not yet claimed: a "Send app link" away from being theirs. */
  addedAtCounter?: boolean
}

export type CustomerLookup = {
  /** The number as Identity would store it. */
  phone: string
  phoneValid: boolean
  /** The customer with exactly this number, if any. */
  match: IdentityCustomer | null
  /** Up to three whose names look like the one typed. */
  similar: IdentityCustomer[]
}

export type ClaimLink = { token: string; expiresAt: string }

export function customerName(customer: IdentityCustomer): string {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    customer.username ||
    ''
  )
}

/** A lookup is worth making once a number is most of the way typed, or a name has begun. */
export const MIN_PHONE_DIGITS = 7
export const MIN_NAME_LENGTH = 2
const LOOKUP_DEBOUNCE_MS = 300

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * Who the till may already know, as the cashier types: the customer with
 * this number (normalized server-side the way it would be stored) and a few
 * with a name like this one.
 */
export function useCustomerLookup(phone: string, name: string, enabled: boolean) {
  const phoneTerm = digitCount(phone) >= MIN_PHONE_DIGITS ? phone.trim() : ''
  const nameTerm = normalizeName(name).length >= MIN_NAME_LENGTH ? name.trim() : ''
  const debounced = useDebounced({ phone: phoneTerm, name: nameTerm }, LOOKUP_DEBOUNCE_MS)
  return useQuery({
    queryKey: ['customerLookup', debounced.phone, debounced.name],
    queryFn: async () => {
      const response = await apiClient.get<CustomerLookup>('/api/identity/customers/lookup', {
        params: {
          phone: debounced.phone || undefined,
          name: debounced.name || undefined,
        },
      })
      return response.data
    },
    placeholderData: keepPreviousData,
    enabled: enabled && (debounced.phone.length > 0 || debounced.name.length > 0),
    staleTime: 10_000,
  })
}

/** 201 with the new customer; 409 carries the one who already has the number. */
export async function createCounterCustomer(name: string, phoneNumber: string) {
  const response = await apiClient.post<IdentityCustomer>('/api/identity/customers', {
    name,
    phoneNumber,
  })
  return response.data
}

export async function issueClaimLink(customerId: string) {
  const response = await apiClient.post<ClaimLink>(
    `/api/identity/customers/${encodeURIComponent(customerId)}/claim-link`
  )
  return response.data
}

/** Where the customer opens the link: the café's customer host. */
export function claimUrl(customerOrigin: string, token: string): string {
  return `${customerOrigin.replace(/\/$/, '')}/claim?token=${encodeURIComponent(token)}`
}

/**
 * Whether a customer the till is looking at was added at the counter and
 * has not claimed the account yet. Known already when they came from a
 * search; otherwise asked by their number, which only answers for them.
 */
export function useAddedAtCounter(
  customer: { id: string; phone?: string | null; addedAtCounter?: boolean } | null
): boolean {
  const known = customer?.addedAtCounter
  const phone = customer?.phone ?? ''
  const query = useQuery({
    queryKey: ['customerLookup', phone, ''],
    queryFn: async () => {
      const response = await apiClient.get<CustomerLookup>('/api/identity/customers/lookup', {
        params: { phone },
      })
      return response.data
    },
    enabled: !!customer && known === undefined && digitCount(phone) >= MIN_PHONE_DIGITS,
    staleTime: 30_000,
    retry: false,
  })
  if (known !== undefined) return known
  return !!customer && query.data?.match?.id === customer.id && !!query.data.match.addedAtCounter
}
