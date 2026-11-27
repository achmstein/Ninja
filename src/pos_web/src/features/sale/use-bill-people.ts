import { useEffect, useState } from 'react'
import { pendingTicketCustomerKey } from '@/features/floor/new-ticket-dialog'
import { stayRoster } from '@/features/places/status'
import { useStayActions } from '@/features/places/use-places'
import { toNumber } from '@/lib/money'
import { billPeople } from './bill-people'
import { samePerson, useSale, type SaleCustomer } from './cart'
import type { useOpenBill } from './use-open-bill'

/** The customer a tab was opened for (the new-tab dialog): read once, then forgotten */
function takePendingCustomer(ticketId: number): SaleCustomer | null {
  try {
    const key = pendingTicketCustomerKey(ticketId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    localStorage.removeItem(key)
    const customer = JSON.parse(raw) as SaleCustomer
    return customer?.id ? customer : null
  } catch {
    return null
  }
}

/**
 * Whose the order is, as the order screen works with it: the names over the
 * order. On an open bill they are its people:
 *
 * - **Who they are**: the room's members, whoever earlier rounds were rung up
 *   for, and anyone named since the bill was opened here (`billPeople`).
 * - **Whose the next items are** (`forWho`): the name tapped, nobody once it
 *   was let go of. Untouched, a bill that is one person's is theirs without a
 *   tap. Their usuals and saved options follow from it.
 * - **Adding one** (`add`): found by name, they join the names and are picked;
 *   in a room they become a member at once, whether they order or not.
 * - **Their card** (`card`): opened by holding a name; while the room's clock
 *   runs, anyone but whoever it was started for can be taken out from there.
 *
 * A new sale (no `ticketId`) reads the same way with one name at most: its
 * customer, kept by the cart. Tapped, they are let go of; another found by
 * name takes their place.
 */
export function useBillPeople(ticketId: number | undefined, bill: ReturnType<typeof useOpenBill>) {
  const onBill = ticketId !== undefined
  const { customer, setCustomer } = useSale()
  const stayActions = useStayActions()
  const [named, setNamed] = useState<SaleCustomer[]>([])
  // undefined until a name is tapped or let go of
  const [chosen, setChosen] = useState<SaleCustomer | null | undefined>(undefined)
  const [cardFor, setCardFor] = useState<SaleCustomer | null>(null)
  useEffect(() => {
    const opened = ticketId === undefined ? null : takePendingCustomer(ticketId)
    setNamed(opened ? [opened] : [])
    setChosen(undefined)
    setCardFor(null)
  }, [ticketId])

  const roster = stayRoster(bill.stay)
  const all = onBill ? billPeople(roster, bill.ticket?.lines ?? [], named) : customer ? [customer] : []
  const forWho = !onBill
    ? customer
    : chosen === undefined
      ? all.length === 1
        ? all[0]
        : null
      : (all.find((person) => samePerson(person, chosen)) ?? null)

  /** Somebody with an account named on a room's bill is in the room: their share of the time will need a tab at settle */
  const join = (who: SaleCustomer) => {
    if (bill.stay && who.id && !roster.some((member) => member.id === who.id)) {
      stayActions.addMember(toNumber(bill.stay.id), who.id, who.name)
    }
  }

  const member = (bill.runningStay?.members ?? []).find((m) => !!cardFor?.id && String(m.customerId) === cardFor.id)

  return {
    all,
    forWho,
    /** A name tapped: theirs from now on, or nobody's when it was already */
    pick: (who: SaleCustomer) => {
      const next = samePerson(who, forWho) ? null : who
      if (onBill) setChosen(next)
      else setCustomer(next)
    },
    add: (who: SaleCustomer) => {
      if (!onBill) return setCustomer(who)
      setNamed((known) => [...known, who])
      setChosen(who)
      join(who)
    },
    join,
    card: {
      /** Only somebody with an account has a card */
      customer: cardFor?.id ? { id: cardFor.id, name: cardFor.name, phone: cardFor.phone } : null,
      open: (who: SaleCustomer) => who.id && setCardFor(who),
      close: () => setCardFor(null),
      removable: !!member && member.role !== 'Owner',
      busy: stayActions.isBusy,
      remove: () => {
        if (!bill.runningStay || !cardFor?.id) return
        stayActions.removeMember(toNumber(bill.runningStay.id), cardFor.id)
        // Named here only: gone from the names too. Somebody with items on the bill stays among them
        setNamed((known) => known.filter((person) => !samePerson(person, cardFor)))
        if (samePerson(chosen, cardFor)) setChosen(null)
        setCardFor(null)
      },
    },
  }
}

export type BillPeople = ReturnType<typeof useBillPeople>
