import { useEffect } from 'react'
import { now } from '@/lib/clock'
import { ghostTap } from '@/lib/ghost'
import { brandById } from './menu'
import { guestOrder, incoming, kitchenOrders, TABLE, useCafe, waiting } from './store'

/**
 * The café's day going on by itself, once a second while the page is shown.
 * Staff take a guest's order if nobody at the page does, and make what is on
 * the board; walk-ins come to the counter; and while nobody has touched a
 * screen, a guest at the table orders by themselves, the page's own finger
 * showing where. Whatever a visitor does goes through the same store.
 */

/** A guest's order is taken at the till this long after it lands, if the visitor has not */
const TAKE_AFTER = 2600
/** The guest's own order is made this long after it is taken */
const MAKE_GUEST_AFTER = 9000
/** No order waits longer than this on the board */
const MAKE_ANY_AFTER = 7 * 60_000
/** The board keeps about this many orders being made */
const BOARD = 3
/** With the line down, walk-ins stop once this many sales are waiting to be sent */
const QUEUE = 4
/** A walk-in comes this often, when the board has room */
const WALK_IN_EVERY = 14_000
/** The page's guest starts a new order this long after their last one left the screens */
const ORDER_AGAIN_AFTER = 3500

export function useCafeRunner() {
  useEffect(() => {
    let lastWalkIn = now()
    let idleSince = now() - ORDER_AGAIN_AFTER + 1200
    let step = 0
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))

    const tick = () => {
      if (document.hidden) return
      const at = now()
      const cafe = useCafe.getState()
      cafe.clearServed(at)

      for (const o of incoming(cafe.orders)) {
        if (at - o.sentAt >= TAKE_AFTER) {
          ghostTap('accept')
          later(() => useCafe.getState().accept(o.key, now()), 350)
        }
      }

      const making = kitchenOrders(cafe.orders).filter((o) => o.stage === 'making')
      const due = making.find((o) => (o.from === 'phone' && o.where === TABLE ? at - o.sentAt >= MAKE_GUEST_AFTER : at - o.sentAt >= MAKE_ANY_AFTER)) ?? (making.length > BOARD ? making[0] : undefined)
      if (due) {
        ghostTap(`bump-${due.key}`)
        later(() => useCafe.getState().bump(due.key, now()), 350)
      }

      // With the line down the sales pile up at the till; a few is enough to show it
      if (at - lastWalkIn >= WALK_IN_EVERY && making.length < BOARD && waiting(cafe.orders).length < QUEUE) {
        lastWalkIn = at
        const items = brandById(cafe.brand).items
        const first = items[Math.floor(Math.random() * items.length)]
        const second = items[Math.floor(Math.random() * items.length)]
        cafe.walkIn(first === second ? [{ id: first.id, qty: 2 }] : [{ id: first.id, qty: 1 }, { id: second.id, qty: 1 }], at)
      }

      // The page's own guest, until a person takes over; never for someone who asked for less motion
      if (cafe.touched || calm) return
      if (guestOrder(cafe.orders)) {
        idleSince = at
        step = 0
        return
      }
      if (at - idleSince < ORDER_AGAIN_AFTER) return
      const items = brandById(cafe.brand).items
      if (step === 0) {
        ghostTap(`add-${items[0].id}`)
        later(() => !useCafe.getState().touched && useCafe.getState().addToCart(items[0].id), 300)
      } else if (step === 1) {
        const other = items[1]
        ghostTap(`add-${other.id}`)
        later(() => !useCafe.getState().touched && useCafe.getState().addToCart(other.id), 300)
      } else if (step === 3) {
        ghostTap('order')
        later(() => !useCafe.getState().touched && useCafe.getState().placeOrder(now()), 450)
      }
      step += 1
    }

    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearInterval(id)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])
}
