import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, Check, CloudOff, Minus, Plus, ReceiptText, Smartphone } from 'lucide-react'
import { itemById, photo } from '@/cafe/menu'
import { incoming, linesCount, linesTotal, useBrand, useCafe, waiting, type Order } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { now } from '@/lib/clock'
import { Tap } from '@/lib/ghost'
import { useLang } from '@/lib/lang'
import { spring } from '@/lib/motion'
import { Odometer } from '@/lib/odometer'
import { Tablet } from './frames'

/** The till's canvas: a tablet on its side, or stood up where the page is narrow */
const WIDE: [number, number] = [1000, 600]
const NARROW: [number, number] = [600, 840]

/**
 * The till, as pos_web draws it: what guests have sent waiting to be taken,
 * the sale pad, the current sale and its charge. With the line down it keeps
 * selling on provisional receipts.
 */
export function Till({ narrow, className }: { narrow?: boolean; className?: string }) {
  const { c, w } = useLang()
  const brand = useBrand()
  const sale = useCafe((s) => s.sale)
  const orders = useCafe((s) => s.orders)
  const requests = useCafe((s) => s.requests)
  const online = useCafe((s) => s.online)
  const { ring, charge, accept, answer, touch } = useCafe.getState()
  const [paid, setPaid] = useState<Order | null>(null)
  const queue = waiting(orders).length
  const asks = incoming(orders)

  useEffect(() => {
    if (!paid) return
    const id = window.setTimeout(() => setPaid(null), 1700)
    return () => window.clearTimeout(id)
  }, [paid])

  return (
    <Tablet logical={narrow ? NARROW : WIDE} className={className}>
      <div className='absolute inset-0 flex flex-col' onPointerDown={touch} onKeyDown={touch}>
        <div className='flex h-[60px] shrink-0 items-center gap-[16px] border-b border-slate-200 px-[20px]'>
          <div className='text-[20px] font-extrabold'>{c.ui.till}</div>
          {!narrow && <div className='text-[14px] text-slate-500'>{c.ui.shift}</div>}
          <div
            className={cn(
              'ms-auto flex h-[34px] items-center gap-[8px] rounded-full px-[14px] text-[13px] font-semibold transition-colors',
              online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'
            )}
          >
            {online ? <span className='size-[8px] rounded-full bg-emerald-500' /> : <CloudOff size={15} />}
            {online ? c.ui.online : queue > 0 ? `${c.ui.offline} · ${queue} ${c.ui.toSend}` : c.ui.offline}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-1', narrow && 'flex-col')}>
          <div className='no-bar min-w-0 flex-1 overflow-y-auto p-[16px]'>
            <AnimatePresence initial={false}>
              {asks.map((o) => (
                <motion.div
                  key={`o${o.key}`}
                  layout
                  initial={{ opacity: 0, y: -24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={spring}
                  className='mb-[12px] flex items-center gap-[14px] rounded-[16px] bg-amber-100 p-[14px] ring-2 ring-amber-400'
                >
                  <span className='grid size-[44px] shrink-0 place-items-center rounded-full bg-amber-400'>
                    <Smartphone size={20} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='text-[16px] font-bold'>
                      {c.ui.places[o.where] ?? o.where} · {c.ui.orderFromPhone}
                    </div>
                    <div className='truncate text-[14px] text-slate-700'>{o.lines.map((l) => `${l.qty} ${w(itemById(l.id).name)}`).join(c.ui.comma)}</div>
                  </div>
                  <div className='text-[16px] font-bold'>
                    {c.ui.egp} {o.total}
                  </div>
                  <button type='button' onClick={() => accept(o.key, now())} className='relative h-[44px] rounded-[12px] bg-slate-900 px-[20px] text-[15px] font-bold text-white'>
                    {c.ui.accept}
                    <Tap id='accept' />
                  </button>
                </motion.div>
              ))}
              {requests.map((r) => (
                <motion.div
                  key={`r${r.key}`}
                  layout
                  initial={{ opacity: 0, y: -24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={spring}
                  className='mb-[12px] flex items-center gap-[14px] rounded-[16px] bg-sky-50 p-[14px] ring-1 ring-sky-200'
                >
                  <span className='grid size-[44px] shrink-0 place-items-center rounded-full bg-sky-200'>{r.kind === 'waiter' ? <BellRing size={20} /> : <ReceiptText size={20} />}</span>
                  <div className='flex-1 text-[16px] font-bold'>
                    {c.ui.places[r.where] ?? r.where} · {r.kind === 'waiter' ? c.ui.wantsWaiter : c.ui.wantsBill}
                  </div>
                  <button type='button' onClick={() => answer(r.key)} className='h-[44px] rounded-[12px] bg-white px-[20px] text-[15px] font-bold ring-1 ring-slate-200'>
                    {c.ui.done}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className={cn('grid gap-[12px]', narrow ? 'grid-cols-3' : 'grid-cols-4')}>
              {brand.items.map((item) => (
                <motion.button
                  key={item.id}
                  type='button'
                  whileTap={{ scale: 0.94 }}
                  transition={spring}
                  onClick={() => ring(item.id)}
                  className='rounded-[14px] border border-slate-200 bg-white p-[8px] text-start shadow-[0_1px_2px_rgb(0_0_0/.05)]'
                >
                  <img src={photo(item.id)} alt='' loading='lazy' className='aspect-[4/3] w-full rounded-[10px] object-cover' />
                  <div className='mt-[8px] truncate text-[14px] font-semibold'>{w(item.name)}</div>
                  <div className='text-[13px] text-slate-500'>{item.price}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className={cn('flex shrink-0 flex-col border-slate-200 p-[18px]', narrow ? 'h-[250px] border-t' : 'w-[310px] border-s')}>
            <div className='flex items-baseline justify-between'>
              <div className='text-[18px] font-bold'>{c.ui.currentSale}</div>
              <div className='text-[13px] text-slate-500'>
                {linesCount(sale)} {linesCount(sale) === 1 ? c.ui.item : c.ui.items}
              </div>
            </div>
            <div className='no-bar mt-[14px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto'>
              {sale.length === 0 && <div className='rounded-[14px] bg-slate-50 p-[16px] text-[14px] leading-[1.5] text-slate-500'>{c.ui.emptySale}</div>}
              <AnimatePresence initial={false}>
                {sale.map((l) => {
                  const item = itemById(l.id)
                  return (
                    <motion.div key={l.id} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={spring} className='flex items-center gap-[8px]'>
                      <div className='min-w-0 flex-1 truncate text-[15px] font-semibold'>{w(item.name)}</div>
                      <button type='button' aria-label={`− ${w(item.name)}`} onClick={() => ring(l.id, -1)} className='grid size-[36px] place-items-center rounded-full bg-slate-100'>
                        <Minus size={15} />
                      </button>
                      <Odometer value={String(l.qty)} className='min-w-[16px] text-center text-[15px] font-bold' />
                      <button type='button' aria-label={`+ ${w(item.name)}`} onClick={() => ring(l.id)} className='grid size-[36px] place-items-center rounded-full bg-slate-100'>
                        <Plus size={15} />
                      </button>
                      <div className='w-[44px] text-end text-[15px] font-semibold'>{item.price * l.qty}</div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
            <button
              type='button'
              disabled={sale.length === 0}
              onClick={() => setPaid(charge(now()))}
              className='mt-[12px] flex h-[56px] shrink-0 items-center justify-between rounded-[14px] bg-slate-900 px-[20px] text-[17px] font-bold text-white transition-opacity disabled:opacity-35'
            >
              <span>{c.ui.charge}</span>
              <Odometer value={`${c.ui.egp} ${linesTotal(sale)}`} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {paid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-[12px] bg-white/95'>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className='grid size-[96px] place-items-center rounded-full bg-emerald-500 text-white'>
                <Check size={52} strokeWidth={3} />
              </motion.span>
              <div className='text-[28px] font-extrabold'>
                {c.ui.paid} · {c.ui.egp} {paid.total}
              </div>
              <div className='text-[16px] text-slate-500'>{paid.provisional ? `${c.ui.receipt} ${paid.provisional} · ${c.ui.sendsWhenBack}` : `${c.ui.cash} · ${c.ui.receipt} #${paid.no}`}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Tablet>
  )
}
