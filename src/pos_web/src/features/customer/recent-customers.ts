import type { SaleCustomer } from '@/features/sale/cart'

const KEY = 'pos.recentCustomers'
const MAX = 5

/**
 * The customers picked on this till lately, newest first. Only what stands in for the branch's
 * own list (read from its bills, the same on every till) while the server cannot be asked.
 */
export function readRecentCustomers(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as { id?: string; name?: string }[]) : []
    return Array.isArray(list) ? list.filter((c): c is { id: string; name: string } => !!c?.id && !!c.name) : []
  } catch {
    return []
  }
}

/** Only an account is remembered: a bare name is nobody to find again */
export function rememberRecentCustomer(customer: SaleCustomer) {
  if (!customer.id) return
  try {
    const rest = readRecentCustomers().filter((c) => c.id !== customer.id)
    localStorage.setItem(KEY, JSON.stringify([{ id: customer.id, name: customer.name }, ...rest].slice(0, MAX)))
  } catch {
    // A browser that refuses storage only loses the shortcut
  }
}
