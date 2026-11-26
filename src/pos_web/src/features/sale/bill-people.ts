import type { TicketLineView } from '@/api/sales/types.gen'
import { samePerson, type SaleCustomer } from './cart'

/**
 * Everyone an open bill already knows, each once, in the order they came:
 * the room's people, whoever earlier rounds were rung up for (an account, or
 * a name the till was only told), then anyone named for it since. They are
 * who Send offers first when it asks whose round this is.
 */
export function billPeople(
  roster: readonly { id: string; name: string }[],
  lines: readonly Pick<TicketLineView, 'customerId' | 'customerName'>[],
  extra: readonly SaleCustomer[] = [],
): SaleCustomer[] {
  const people: SaleCustomer[] = []
  const add = (person: SaleCustomer) => {
    if (!people.some((known) => samePerson(known, person))) people.push(person)
  }
  for (const member of roster) add({ id: member.id, name: member.name })
  for (const line of lines) {
    if (line.customerId) add({ id: String(line.customerId), name: line.customerName ?? '' })
    else if (line.customerName) add({ id: null, name: line.customerName })
  }
  for (const person of extra) add(person)
  return people
}

/** How a person is said in a tight spot: their first name */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}
