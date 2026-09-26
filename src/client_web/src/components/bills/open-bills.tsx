import { Children, type ReactNode } from 'react'
import { type LiveBills } from '@/lib/live-bills'
import { BillCard } from './bill-card'

/**
 * The bills open now, each with its rounds standing open and the ones on
 * their way already on it: the dock's live bill sheet and the bills page
 * both show them so. One fills the width; two or more (a table and a room)
 * sit side by side and swipe, like the menu's categories.
 */
export function OpenBills({ live }: { live: LiveBills }) {
  return (
    <Swipe>
      {live.forming && <BillCard key='forming' bill={live.forming.bill} pending={live.forming.rounds} ordersById={live.ordersById} takeover />}
      {live.open.map(({ bill, pending }) => (
        <BillCard key={String(bill.id)} bill={bill} pending={pending} ordersById={live.ordersById} takeover />
      ))}
    </Swipe>
  )
}

/** Whether there is a bill to show: one open, or one forming out of rounds on their way */
export function hasLiveBill(live: LiveBills): boolean {
  return live.forming != null || live.open.length > 0
}

function Swipe({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children).filter(Boolean)
  if (cards.length <= 1) return <>{cards}</>
  return (
    <div className='no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4'>
      {cards.map((card, i) => (
        <div key={i} className='w-[88%] shrink-0 snap-center'>
          {card}
        </div>
      ))}
    </div>
  )
}
