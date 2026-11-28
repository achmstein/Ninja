import type { TicketLineView } from '@/api/sales/types.gen'
import { samePerson, type SaleCustomer } from './cart'

/**
 * Everyone an open bill already knows, each once, in the order they came:
 * the room's people, whoever earlier rounds were rung up for (an account, or
 * a name the till was only told), then anyone named for it since. They are
 * the names over the order: one tapped, and what is rung up next is theirs.
 */
export function billPeople(
  roster: readonly { id: string; name: string }[],
  lines: readonly Pick<TicketLineView, 'customerId' | 'customerName'>[],
  extra: readonly SaleCustomer[] = []
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

/**
 * The names as the row over the order writes them, one for each person in
 * order: the first name, which is how a cashier calls them and lets four fit
 * where one whole name did. Two people who share it are written by two names,
 * and by the whole of it if they still read alike. The whole name stays on
 * the order's lines and on the customer's card.
 */
export function shortNames(names: readonly string[]): string[] {
  const words = names.map((name) => name.trim().split(/\s+/).filter(Boolean))
  const take = (count: number) => words.map((w) => w.slice(0, count).join(' '))
  const first = take(1)
  const two = take(2)
  const shared = (list: string[], at: number) => list.some((other, i) => i !== at && other === list[at])
  return names.map((name, at) => (!shared(first, at) ? first[at] : !shared(two, at) ? two[at] : name.trim()))
}
