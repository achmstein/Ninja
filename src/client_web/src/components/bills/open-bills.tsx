import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
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

/**
 * Two bills or more, side by side: a finger swipes between them, and with a
 * mouse (no sideways wheel) the arrows at the edges step one bill over. The
 * dots under them say which bill is in view. The row is as tall as the
 * bill in view, not the tallest one (a long receipt printed out under the
 * other bill), and eases to the next one's height as it comes in.
 */
function Swipe({ children }: { children: ReactNode }) {
  const t = useT()
  const cards = Children.toArray(children).filter(Boolean)
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [height, setHeight] = useState<number | null>(null)
  const many = cards.length > 1

  // The bill in view sets the row's height, following it as it grows (its stack fanning, its receipt printing)
  useEffect(() => {
    const card = track.current?.children[index] as HTMLElement | undefined
    if (!many || !card) return
    const watch = new ResizeObserver(() => setHeight(card.offsetHeight))
    watch.observe(card)
    return () => watch.disconnect()
  }, [index, many])

  if (!many) return <>{cards}</>

  const cardsIn = () => Array.from(track.current?.children ?? []) as HTMLElement[]
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const middle = el.getBoundingClientRect().left + el.clientWidth / 2
    let best = 0
    let bestGap = Infinity
    cardsIn().forEach((card, i) => {
      const box = card.getBoundingClientRect()
      const gap = Math.abs(box.left + box.width / 2 - middle)
      if (gap < bestGap) {
        best = i
        bestGap = gap
      }
    })
    setIndex(best)
  }
  const go = (to: number) => cardsIn()[to]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })

  return (
    <div className='relative'>
      {/* items-start: each bill keeps its own height, rather than stretching to the tallest; the row
          clips to the one in view, so a taller one beside it hangs out of sight, not as empty space */}
      <div
        ref={track}
        onScroll={onScroll}
        className='no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden px-4 transition-[height] duration-300 ease-out motion-reduce:transition-none'
        style={height != null ? { height } : undefined}
      >
        {cards.map((card, i) => (
          <div key={i} className='w-[88%] shrink-0 snap-center'>
            {card}
          </div>
        ))}
      </div>
      {/* Arrows only where there is a mouse; a finger swipes */}
      {index > 0 && <StepArrow side='start' label={t('ninjaBillPrev')} onClick={() => go(index - 1)} />}
      {index < cards.length - 1 && <StepArrow side='end' label={t('ninjaBillNext')} onClick={() => go(index + 1)} />}
      <div className='mt-3 flex justify-center gap-1.5'>
        {cards.map((_, i) => (
          <button
            key={i}
            type='button'
            aria-label={`${i + 1} / ${cards.length}`}
            aria-current={i === index || undefined}
            onClick={() => go(i)}
            className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'bg-foreground w-4' : 'bg-foreground/25 w-1.5')}
          />
        ))}
      </div>
    </div>
  )
}

function StepArrow({ side, label, onClick }: { side: 'start' | 'end'; label: string; onClick: () => void }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight
  return (
    <button
      type='button'
      aria-label={label}
      onClick={onClick}
      className={cn(
        'bg-background/90 absolute top-8 hidden size-9 place-items-center rounded-full shadow-md backdrop-blur [@media(pointer:fine)]:grid',
        side === 'start' ? '-start-2' : '-end-2'
      )}
    >
      <Icon className='size-4 rtl:rotate-180' />
    </button>
  )
}
