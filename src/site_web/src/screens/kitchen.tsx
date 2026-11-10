import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChefHat, Undo2 } from 'lucide-react'
import { itemById } from '@/cafe/menu'
import { kitchenOrders, useCafe, type Order } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { elapsed, now, useNow } from '@/lib/clock'
import { Tap } from '@/lib/ghost'
import { useLang } from '@/lib/lang'
import { spring } from '@/lib/motion'
import { Tablet } from './frames'

/** The kitchen's canvas: a tablet, a low strip of it beside the till, or a small one where the page is narrow */
const SIZES = { full: [1040, 620], strip: [1000, 352], narrow: [600, 400] } satisfies Record<string, [number, number]>
export type KitchenSize = keyof typeof SIZES

/** What the bar makes; everything else is the kitchen's. A station takes its own categories, as in the app */
const BAR = new Set(['latte', 'cappuccino', 'flatwhite', 'mocha', 'lemonade', 'gshake', 'mocktail'])
type Station = 'all' | 'kitchen' | 'bar'
const makes = (station: Station, id: string) => station === 'all' || (station === 'bar') === BAR.has(id)

/** How long an order has waited decides its colour: fresh, then amber, then late (ms) */
const AMBER_AFTER = 3 * 60_000
const LATE_AFTER = 6 * 60_000

/**
 * The kitchen screen, as kds_web draws it: a card per order, coloured by how
 * long it has waited, each station seeing its own lines, ready in one tap.
 */
export function KitchenScreen({ size = 'full', className }: { size?: KitchenSize; className?: string }) {
  const { c } = useLang()
  const at = useNow(1000)
  const all = useCafe((s) => s.orders)
  const touch = useCafe((s) => s.touch)
  const [station, setStation] = useState<Station>('all')
  const tickets = kitchenOrders(all).filter((o) => o.lines.some((l) => makes(station, l.id)))
  const making = tickets.filter((o) => o.stage === 'making').length
  return (
    <Tablet logical={SIZES[size]} screen='#f8fafc' className={className}>
      <div className='absolute inset-0 flex flex-col' onPointerDown={touch} onKeyDown={touch}>
        <div className='flex h-[56px] shrink-0 items-center gap-[12px] border-b border-slate-200 bg-white px-[20px]'>
          <ChefHat size={22} />
          <div className='text-[20px] font-extrabold'>{c.ui.kitchen}</div>
          <div className='ms-[8px] flex gap-[4px] rounded-[12px] bg-slate-100 p-[4px]'>
            {(['all', 'kitchen', 'bar'] as const).map((id) => (
              <button
                key={id}
                type='button'
                onClick={() => setStation(id)}
                className={cn('h-[34px] rounded-[9px] px-[14px] text-[14px] font-semibold transition-colors', station === id ? 'bg-white shadow-sm' : 'text-slate-500')}
              >
                {c.ui.stations[id]}
              </button>
            ))}
          </div>
          <div className='ms-auto text-[14px] text-slate-500'>
            {making} {c.ui.toPrepare}
          </div>
        </div>
        <div className='no-bar flex min-h-0 flex-1 items-start gap-[12px] overflow-x-auto overflow-y-hidden p-[14px]'>
          <AnimatePresence initial={false} mode='popLayout'>
            {tickets.map((o) => (
              <TicketCard key={o.key} order={o} at={at} station={station} />
            ))}
          </AnimatePresence>
          {tickets.length === 0 && <div className='m-auto text-[16px] text-slate-400'>{c.ui.kitchenClear}</div>}
        </div>
      </div>
    </Tablet>
  )
}

function TicketCard({ order, at, station }: { order: Order; at: number; station: Station }) {
  const { c, w } = useLang()
  const reduced = useReducedMotion()
  const { bump, bringBack } = useCafe.getState()
  const ready = order.stage === 'ready'
  const waited = at - order.sentAt
  const band = ready
    ? 'bg-emerald-500/15 text-emerald-700'
    : waited >= LATE_AFTER
      ? 'bg-red-600/10 text-red-600'
      : waited >= AMBER_AFTER
        ? 'bg-amber-500/15 text-amber-700'
        : 'bg-slate-100/60 text-slate-950'
  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -160, boxShadow: '0 0 40px rgb(245 158 11 / .9)' }}
      animate={{ opacity: 1, y: 0, boxShadow: '0 0 0px rgb(245 158 11 / 0)' }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ ...spring, boxShadow: { duration: 1.2 } }}
      className={cn('w-[240px] shrink-0 overflow-hidden rounded-[14px] border bg-white', !ready && waited >= LATE_AFTER ? 'border-red-600/50' : 'border-slate-200')}
    >
      <div className={cn('px-[14px] py-[12px] transition-colors', band)}>
        <div className='flex items-center gap-[8px]'>
          <span className='text-[16px] font-extrabold'>{order.no !== null ? `#${order.no}` : order.provisional}</span>
          <span className='rounded-full bg-white/70 px-[8px] py-[2px] text-[12px] font-bold text-slate-950'>{order.from === 'phone' ? c.ui.phone : c.ui.tillShort}</span>
          <span dir='ltr' className='ms-auto text-[20px] font-bold tabular-nums'>
            {ready ? '' : elapsed(order.sentAt, at)}
          </span>
          {ready && <span className='text-[18px] font-bold'>{c.ui.ready}</span>}
        </div>
        <div className='mt-[4px] text-[18px] font-semibold text-slate-950'>{c.ui.places[order.where] ?? order.where}</div>
      </div>
      <div className='flex flex-col gap-[8px] px-[14px] py-[12px]'>
        {order.lines
          .filter((l) => makes(station, l.id))
          .map((l) => (
            <div key={l.id} className='flex gap-[10px] text-[16px]'>
              <span className='w-[18px] font-extrabold'>{l.qty}</span>
              <span className='font-semibold'>{w(itemById(l.id).name)}</span>
            </div>
          ))}
      </div>
      <div className='px-[14px] pb-[14px]'>
        <motion.button
          type='button'
          whileTap={{ scale: 0.94 }}
          onClick={() => (ready ? bringBack(order.key) : bump(order.key, now()))}
          className={cn('relative flex h-[48px] w-full items-center justify-center gap-[8px] rounded-[12px] text-[15px] font-bold', ready ? 'bg-slate-100' : 'bg-slate-900 text-white')}
        >
          {ready ? <Undo2 size={16} /> : <Check size={16} />}
          {ready ? c.ui.bringBack : c.ui.ready}
          <Tap id={`bump-${order.key}`} />
        </motion.button>
      </div>
    </motion.div>
  )
}
