import { useEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { BellRing, Check, ChefHat, ChevronUp, Clock, Coffee, Gamepad2, Minus, Plus, ReceiptText, ScanLine, User, X, type LucideIcon } from 'lucide-react'
import { equalSplit, itemsSplit, ROOM_TARIFF, sessionBill, type RateId, type Stretch } from '@/cafe/bill'
import { itemById, photo, type Brand, type Item } from '@/cafe/menu'
import { HOLD_MINUTES, PLACES, type Place } from '@/cafe/places'
import { guestOrder, linesCount, linesTotal, POINTS_PER_POUND, TABLE, tierOf, TIERS, useBrand, useCafe } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { now, useNow } from '@/lib/clock'
import { Tap } from '@/lib/ghost'
import { useLang } from '@/lib/lang'
import { spring, springSoft } from '@/lib/motion'
import { Odometer } from '@/lib/odometer'
import { FLIGHT_SPRING, FlyingPhoto, planFlight, type Flight } from '@/lib/photo-flight'
import { Phone, PHONE } from './frames'

export type GuestTab = 'menu' | 'book' | 'you'
export type MenuLayout = 'list' | 'tiles'

/**
 * The guest's app, as client_web draws it in the Ninja style: the menu with
 * its floating dock, the Book tab and the You tab. It runs on the page's
 * café, so what is ordered here is what the till and the kitchen get.
 */
export function GuestPhone({
  tab: firstTab = 'menu',
  layout = 'list',
  bill: billFirst = false,
  className,
}: {
  tab?: GuestTab
  layout?: MenuLayout
  /** Open on the table's bill */
  bill?: boolean
  className?: string
}) {
  const brand = useBrand()
  const touch = useCafe((s) => s.touch)
  const [tab, setTab] = useState<GuestTab>(firstTab)
  const [billOpen, setBillOpen] = useState(billFirst)
  const room = useRef<HTMLDivElement>(null)
  return (
    <Phone className={className}>
      <div ref={room} className='absolute inset-0' style={{ '--brand': brand.primary, '--slab': brand.slab } as React.CSSProperties} onPointerDown={touch} onKeyDown={touch}>
        <TopBar brand={brand} />
        {tab === 'menu' && <MenuTab brand={brand} layout={layout} room={room} />}
        {tab === 'book' && <BookTab />}
        {tab === 'you' && <YouTab />}
        <Dock tab={tab} onTab={setTab} onBill={() => setBillOpen(true)} />
        <AnimatePresence>{billOpen && <BillSheet brand={brand} onClose={() => setBillOpen(false)} />}</AnimatePresence>
      </div>
    </Phone>
  )
}

function Wordmark({ brand, height }: { brand: Brand; height: number }) {
  return (
    <span
      dir='ltr'
      className='inline-block leading-[1.2]'
      style={{
        fontFamily: `'${brand.logoFont}', cursive`,
        fontSize: height * (brand.logoFont === 'Bungee' ? 0.8 : 0.95),
        fontStyle: brand.logoItalic ? 'italic' : undefined,
        fontWeight: brand.logoItalic ? 700 : 400,
        textTransform: brand.logoUpper ? 'uppercase' : undefined,
        color: 'var(--brand)',
      }}
    >
      {brand.name}
    </span>
  )
}

function TopBar({ brand }: { brand: Brand }) {
  return (
    <div className='absolute inset-x-0 top-[44px] flex h-[64px] items-center justify-between px-[16px]'>
      <Wordmark brand={brand} height={28} />
      <span className='grid size-[40px] place-items-center rounded-full bg-slate-100'>
        <ScanLine size={18} />
      </span>
    </div>
  )
}

function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className='absolute inset-x-[16px] top-[112px]'>
      <div className='text-[28px] leading-[1.2] font-extrabold tracking-[-0.02em]'>{title}</div>
      {sub && <div className='mt-[2px] text-[14px] font-medium text-slate-500'>{sub}</div>}
    </div>
  )
}

// ——— Menu ————————————————————————————————————————————————————————

function AddButton({ item, small }: { item: Item; small?: boolean }) {
  const count = useCafe((s) => s.cart.find((l) => l.id === item.id)?.qty ?? 0)
  const add = useCafe((s) => s.addToCart)
  const { w } = useLang()
  const size = small ? 36 : 44
  return (
    <motion.div
      layout
      transition={spring}
      className='relative flex shrink-0 items-center overflow-hidden rounded-full text-white shadow-[0_8px_20px_-10px_rgb(0_0_0/.45)]'
      style={{ height: size, backgroundColor: 'var(--brand)' }}
    >
      {count > 0 && (
        <>
          <button type='button' aria-label={`− ${w(item.name)}`} className='grid h-full place-items-center' style={{ width: size - 6 }} onClick={() => add(item.id, -1)}>
            <Minus size={16} strokeWidth={2.5} />
          </button>
          <Odometer value={String(count)} className='min-w-[14px] text-center text-[15px] font-extrabold' />
        </>
      )}
      <button type='button' aria-label={`+ ${w(item.name)}`} className='grid h-full place-items-center' style={{ width: count > 0 ? size - 6 : size }} onClick={() => add(item.id)}>
        <Plus size={small ? 18 : 20} strokeWidth={2.5} />
      </button>
      <Tap id={`add-${item.id}`} />
    </motion.div>
  )
}

function MenuTab({ brand, layout, room }: { brand: Brand; layout: MenuLayout; room: React.RefObject<HTMLDivElement | null> }) {
  const { c, w } = useLang()
  const [cat, setCat] = useState<number | null>(null)
  const [open, setOpen] = useState<{ item: Item; from: HTMLElement } | null>(null)
  const items = brand.items.filter((i) => cat === null || i.cat === cat)
  const hasCart = useCafe((s) => s.cart.length > 0)
  const live = useCafe((s) => guestOrder(s.orders) !== undefined)
  return (
    <>
      <PageTitle title={c.ui.menu} sub={c.ui.atTable} />
      <div className='no-bar absolute inset-x-0 top-[188px] flex gap-[8px] overflow-x-auto px-[16px]'>
        {[null, ...brand.categories.map((_, i) => i)].map((i) => (
          <button
            key={i ?? 'all'}
            type='button'
            onClick={() => setCat(i)}
            className={cn('h-[36px] shrink-0 rounded-full px-[14px] text-[13px] font-semibold transition-colors', cat === i ? 'text-white' : 'bg-slate-100 text-slate-700')}
            style={cat === i ? { backgroundColor: 'var(--brand)' } : undefined}
          >
            {i === null ? c.ui.all : w(brand.categories[i])}
          </button>
        ))}
      </div>
      <div
        className={cn('no-bar absolute inset-x-0 top-[236px] bottom-0 overflow-y-auto px-[16px] pt-[8px]', layout === 'tiles' ? 'grid grid-cols-2 content-start gap-[12px]' : 'flex flex-col gap-[14px]')}
        style={{ paddingBottom: hasCart || live ? 156 : 88 }}
      >
        {items.map((item) =>
          layout === 'tiles' ? (
            <div key={item.id} className='relative'>
              <button type='button' className='block w-full text-start' onClick={(e) => setOpen({ item, from: e.currentTarget.firstElementChild as HTMLElement })}>
                <img src={photo(item.id)} alt='' loading='lazy' className='aspect-square w-full rounded-[22px] object-cover' />
                <div className='mt-[8px] truncate text-[15px] font-bold'>{w(item.name)}</div>
                <div className='text-[14px] font-semibold text-slate-500'>{item.price}</div>
              </button>
              <div className='absolute end-[8px] top-[calc(50%-34px)]'>
                <AddButton item={item} small />
              </div>
            </div>
          ) : (
            <div key={item.id} className='flex items-center gap-[12px]'>
              <button type='button' aria-label={w(item.name)} className='shrink-0' onClick={(e) => setOpen({ item, from: e.currentTarget.firstElementChild as HTMLElement })}>
                <img src={photo(item.id)} alt='' loading='lazy' className='size-[92px] rounded-[20px] object-cover' />
              </button>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-[16px] font-bold'>{w(item.name)}</div>
                <div className='truncate text-[13px] text-slate-500'>{w(item.note)}</div>
                <div className='mt-[4px] text-[15px] font-bold'>{item.price}</div>
              </div>
              <AddButton item={item} />
            </div>
          )
        )}
      </div>
      {open && <ItemSheet key={open.item.id} item={open.item} from={open.from} room={room} onClose={() => setOpen(null)} />}
    </>
  )
}

/** An item opened from its photo: the photo flies to the sheet's banner on one spring and back, as in the app */
function ItemSheet({ item, from, room, onClose }: { item: Item; from: HTMLElement; room: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const { c, w } = useLang()
  const reduced = useReducedMotion()
  const add = useCafe((s) => s.addToCart)
  const banner = useRef<HTMLImageElement>(null)
  const progress = useMotionValue(0)
  // The sheet rises the last 40 px of the photo's flight
  const rise = useTransform(progress, [0, 1], [40, 0])
  const [flight, setFlight] = useState<Flight | null>(null)
  const [landed, setLanded] = useState(false)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    const plan = reduced ? null : planFlight(from, banner.current, room.current, PHONE.w)
    setFlight(plan)
    const run = animate(progress, 1, plan ? FLIGHT_SPRING : { duration: 0.15 })
    run.then(() => setLanded(true))
    return () => run.stop()
  }, [from, room, progress, reduced])

  const close = () => {
    setLanded(false)
    animate(progress, 0, flight ? FLIGHT_SPRING : { duration: 0.15 }).then(onClose)
  }
  const flying = flight !== null && !landed

  return (
    <div className='absolute inset-0 z-20'>
      <motion.button type='button' aria-label={c.ui.close} className='absolute inset-0 bg-slate-950/40' style={{ opacity: progress }} onClick={close} />
      <motion.div className='absolute inset-x-0 bottom-0 top-[60px] overflow-hidden rounded-t-[32px] bg-white' style={{ opacity: progress, y: rise }}>
        <img ref={banner} src={photo(item.id)} alt='' className={cn('h-[300px] w-full rounded-t-[32px] object-cover', flying && 'invisible')} />
        <button type='button' aria-label={c.ui.close} onClick={close} className='absolute end-[14px] top-[14px] grid size-[40px] place-items-center rounded-full bg-white/90 shadow'>
          <X size={18} />
        </button>
        <div className='p-[20px]'>
          <div className='flex items-baseline justify-between gap-[12px]'>
            <div className='text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em]'>{w(item.name)}</div>
            <div className='text-[20px] font-bold'>{item.price}</div>
          </div>
          <div className='mt-[6px] text-[15px] text-slate-500'>{w(item.note)}</div>
          <div className='mt-[28px] flex items-center gap-[12px]'>
            <div className='flex h-[56px] items-center rounded-full bg-slate-100'>
              <button type='button' aria-label='−' className='grid size-[56px] place-items-center' onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus size={18} />
              </button>
              <Odometer value={String(qty)} className='min-w-[20px] text-center text-[17px] font-extrabold' />
              <button type='button' aria-label='+' className='grid size-[56px] place-items-center' onClick={() => setQty((q) => q + 1)}>
                <Plus size={18} />
              </button>
            </div>
            <button
              type='button'
              className='flex h-[56px] flex-1 items-center justify-between rounded-full px-[22px] text-[16px] font-bold text-white'
              style={{ backgroundColor: 'var(--brand)' }}
              onClick={() => {
                add(item.id, qty)
                close()
              }}
            >
              <span>{c.ui.add}</span>
              <Odometer value={String(item.price * qty)} />
            </button>
          </div>
        </div>
      </motion.div>
      {flying && <FlyingPhoto flight={flight} progress={progress} />}
    </div>
  )
}

// ——— Dock ————————————————————————————————————————————————————————

const TABS: { id: GuestTab; Icon: LucideIcon }[] = [
  { id: 'menu', Icon: Coffee },
  { id: 'book', Icon: Gamepad2 },
  { id: 'you', Icon: User },
]

/** How long the order button is held before the order goes, in ms */
const HOLD_MS = 650

function Dock({ tab, onTab, onBill }: { tab: GuestTab; onTab: (tab: GuestTab) => void; onBill: () => void }) {
  const { c } = useLang()
  const cart = useCafe((s) => s.cart)
  const order = useCafe((s) => guestOrder(s.orders))
  const row = cart.length > 0 ? 'tray' : order ? 'order' : null
  return (
    <div className='absolute inset-x-[8px] bottom-[8px] z-10 overflow-hidden rounded-[28px] text-white shadow-[0_6px_18px_-10px_rgb(0_0_0/.28)]' style={{ backgroundColor: 'var(--slab)' }}>
      <AnimatePresence initial={false} mode='popLayout'>
        {row && (
          <motion.div
            key={row}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 68, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className='overflow-hidden border-b border-white/10'
          >
            {row === 'tray' ? <TrayRow /> : order && <OrderRow stage={order.stage} total={order.total} onBill={onBill} />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className='flex h-[56px] items-center px-[6px]'>
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type='button'
            onClick={() => onTab(id)}
            aria-current={tab === id}
            className={cn('flex h-[44px] flex-1 items-center justify-center gap-[8px] rounded-full text-[13px] font-semibold transition-colors', tab === id ? 'bg-white/15 text-white' : 'text-white/55')}
          >
            <Icon size={18} />
            {c.ui[id]}
          </button>
        ))}
      </div>
    </div>
  )
}

function TrayRow() {
  const { c } = useLang()
  const cart = useCafe((s) => s.cart)
  const place = useCafe((s) => s.placeOrder)
  const [holding, setHolding] = useState(false)
  const timer = useRef(0)
  const count = linesCount(cart)
  const start = () => {
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setHolding(false)
      place(now())
    }, HOLD_MS)
  }
  const stop = () => {
    setHolding(false)
    window.clearTimeout(timer.current)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <div className='flex h-[68px] items-center gap-[12px] px-[14px]'>
      <div className='flex-1'>
        <div className='text-[13px] font-medium opacity-70'>
          {count} {count === 1 ? c.ui.item : c.ui.items}
        </div>
        <Odometer value={`${c.ui.egp} ${linesTotal(cart)}`} className='text-[16px] font-bold' />
      </div>
      <button
        type='button'
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        // The keyboard has no hold: Enter or Space sends
        onClick={(e) => e.detail === 0 && place(now())}
        className='relative h-[44px] touch-none overflow-hidden rounded-full bg-amber-400 px-[18px] text-[14px] font-bold text-slate-950 select-none'
      >
        <span
          aria-hidden
          className={cn('absolute inset-0 origin-[0_50%] bg-white/55 rtl:origin-[100%_50%]', holding ? 'scale-x-100 transition-transform ease-linear' : 'scale-x-0')}
          style={{ transitionDuration: holding ? `${HOLD_MS}ms` : '0ms' }}
        />
        <span className='relative'>{c.ui.holdToOrder}</span>
        <Tap id='order' />
      </button>
    </div>
  )
}

function OrderRow({ stage, total, onBill }: { stage: 'sent' | 'making' | 'ready'; total: number; onBill: () => void }) {
  const { c } = useLang()
  const reduced = useReducedMotion()
  const look = {
    sent: { Icon: Clock, tone: '#f59e0b', line: c.ui.sentToTill },
    making: { Icon: ChefHat, tone: '#6366f1', line: c.ui.beingMade },
    ready: { Icon: Check, tone: '#10b981', line: c.ui.readyForYou },
  }[stage]
  return (
    <div className='flex h-[68px] items-center gap-[12px] px-[14px]'>
      <motion.span
        key={stage}
        initial={reduced ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={spring}
        className='grid size-[44px] place-items-center rounded-full'
        style={{ backgroundColor: look.tone }}
      >
        <look.Icon size={20} />
      </motion.span>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-[13px] font-medium opacity-70'>{look.line}</div>
        <div className='text-[16px] font-bold'>
          {c.ui.egp} {total}
        </div>
      </div>
      <button type='button' onClick={onBill} className='flex h-[40px] items-center gap-[6px] rounded-full bg-white/12 px-[14px] text-[13px] font-semibold'>
        {c.ui.yourTable}
        <ChevronUp size={16} />
      </button>
    </div>
  )
}

// ——— The table's bill ————————————————————————————————————————————

type SplitMode = 'none' | 'equal' | 'items'

function BillSheet({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const { c, w } = useLang()
  const orders = useCafe((s) => s.orders)
  const requests = useCafe((s) => s.requests)
  const request = useCafe((s) => s.request)
  // What the table has had: the friends' round, then whatever this guest sent from the menu
  const friends = [brand.items[3], brand.items[3], brand.items[brand.items.length - 1], brand.items[1]].map((item, i) => ({ id: `f${i}`, item }))
  const own = orders
    .filter((o) => o.from === 'phone' && o.where === TABLE && o.stage !== 'sent')
    .flatMap((o) => o.lines.flatMap((l) => Array.from({ length: l.qty }, (_, i) => ({ id: `o${o.key}-${l.id}-${i}`, item: itemById(l.id) }))))
  const lines = [...friends, ...own].map((l) => ({ id: l.id, name: w(l.item.name), price: l.item.price }))
  const total = lines.reduce((sum, l) => sum + l.price, 0)

  const [mode, setMode] = useState<SplitMode>('none')
  const [people, setPeople] = useState(4)
  const [mine, setMine] = useState<Set<string>>(() => new Set(own.length ? own.map((l) => l.id) : ['f0']))
  const [paid, setPaid] = useState<number | null>(null)
  const share = mode === 'equal' ? equalSplit(total, people)[0] : mode === 'items' ? itemsSplit(lines, mine).share : total
  const asked = (kind: 'waiter' | 'bill') => requests.some((r) => r.kind === kind && r.where === TABLE)

  return (
    <div className='absolute inset-0 z-20'>
      <motion.button type='button' aria-label={c.ui.close} className='absolute inset-0 bg-slate-950/40' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={springSoft}
        className='no-bar absolute inset-x-0 bottom-0 top-[96px] overflow-y-auto rounded-t-[32px] bg-white p-[20px]'
      >
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-[24px] leading-[1.2] font-extrabold tracking-[-0.02em]'>{c.ui.yourBill}</div>
            <div className='text-[14px] font-medium text-slate-500'>{c.ui.atTable}</div>
          </div>
          <button type='button' aria-label={c.ui.close} onClick={onClose} className='grid size-[40px] place-items-center rounded-full bg-slate-100'>
            <X size={18} />
          </button>
        </div>

        {paid !== null ? (
          <div className='flex flex-col items-center pt-[70px] text-center'>
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className='grid size-[88px] place-items-center rounded-full bg-emerald-500 text-white'>
              <Check size={46} strokeWidth={3} />
            </motion.span>
            <div className='mt-[18px] text-[24px] font-extrabold'>{c.ui.paidThanks}</div>
            <div className='mt-[4px] text-[15px] text-slate-500'>
              {c.ui.egp} {paid} {c.ui.charged}
              {total - paid > 0 && `, ${c.ui.egp} ${total - paid} ${c.ui.leftForFriends}`}
            </div>
            <button type='button' className='mt-[28px] h-[48px] rounded-full bg-slate-100 px-[22px] text-[15px] font-semibold' onClick={() => setPaid(null)}>
              {c.ui.backToBill}
            </button>
          </div>
        ) : (
          <>
            <div className='mt-[16px] grid grid-cols-2 gap-[10px]'>
              {(
                [
                  ['waiter', BellRing, c.ui.callWaiter],
                  ['bill', ReceiptText, c.ui.askBill],
                ] as const
              ).map(([kind, Icon, label]) => (
                <button
                  key={kind}
                  type='button'
                  onClick={() => request(kind, now())}
                  className={cn('flex h-[52px] items-center justify-center gap-[8px] rounded-[16px] text-[14px] font-semibold transition-colors', asked(kind) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100')}
                >
                  {asked(kind) ? <Check size={17} /> : <Icon size={17} />}
                  {asked(kind) ? c.ui.asked : label}
                </button>
              ))}
            </div>

            <div className='mt-[18px] flex flex-col'>
              {lines.map((l) => {
                const picking = mode === 'items'
                const on = mine.has(l.id)
                return (
                  <button
                    key={l.id}
                    type='button'
                    disabled={!picking}
                    onClick={() =>
                      setMine((m) => {
                        const next = new Set(m)
                        if (!next.delete(l.id)) next.add(l.id)
                        return next
                      })
                    }
                    className='flex h-[44px] items-center gap-[10px] border-b border-slate-100 text-start text-[15px]'
                  >
                    {picking && (
                      <span className={cn('grid size-[22px] place-items-center rounded-full border-2 transition-colors', on ? 'border-transparent text-white' : 'border-slate-300')} style={on ? { backgroundColor: 'var(--brand)' } : undefined}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                    )}
                    <span className={cn('flex-1 font-medium', picking && !on && 'text-slate-400')}>{l.name}</span>
                    <span className='font-semibold'>{l.price}</span>
                  </button>
                )
              })}
              <div className='flex h-[48px] items-center justify-between text-[16px] font-bold'>
                <span>{c.ui.total}</span>
                <Odometer value={`${c.ui.egp} ${total}`} />
              </div>
            </div>

            <div className='mt-[6px] flex gap-[6px] rounded-[16px] bg-slate-100 p-[4px]'>
              {(
                [
                  ['none', c.ui.payFully],
                  ['equal', c.ui.divideEqually],
                  ['items', c.ui.payMyItems],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type='button'
                  onClick={() => setMode(id)}
                  className={cn('h-[40px] flex-1 rounded-[12px] text-[13px] font-semibold transition-colors', mode === id ? 'bg-white shadow-sm' : 'text-slate-500')}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'equal' && (
              <div className='mt-[12px] flex items-center justify-between'>
                <span className='text-[15px] font-medium'>{c.ui.people}</span>
                <div className='flex h-[44px] items-center rounded-full bg-slate-100'>
                  <button type='button' aria-label='−' className='grid size-[44px] place-items-center' onClick={() => setPeople((p) => Math.max(2, p - 1))}>
                    <Minus size={16} />
                  </button>
                  <Odometer value={String(people)} className='min-w-[18px] text-center text-[16px] font-extrabold' />
                  <button type='button' aria-label='+' className='grid size-[44px] place-items-center' onClick={() => setPeople((p) => Math.min(8, p + 1))}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}

            <button
              type='button'
              disabled={share <= 0}
              onClick={() => setPaid(share)}
              className='mt-[16px] flex h-[56px] w-full items-center justify-between rounded-full px-[24px] text-[16px] font-bold text-white disabled:opacity-40'
              style={{ backgroundColor: 'var(--brand)' }}
            >
              <span>{mode === 'none' ? c.ui.pay : c.ui.payYourShare}</span>
              <Odometer value={`${c.ui.egp} ${share}`} />
            </button>
            <div className='mt-[10px] text-center text-[12px] text-slate-400'>{c.ui.securePage}</div>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ——— Book ————————————————————————————————————————————————————————

type Stay = { step: 'held'; place: Place; at: number } | { step: 'playing'; place: Place; stretches: Stretch[]; startedAt: number }

/** Minutes of play that pass each real second on the page */
const FAST = 1

function BookTab() {
  const { c, w } = useLang()
  const at = useNow(1000)
  const [stay, setStay] = useState<Stay | null>(null)

  // The clock: every second on the page is a minute in the room
  useEffect(() => {
    if (stay?.step !== 'playing') return
    const id = window.setInterval(
      () =>
        setStay((s) => {
          if (s?.step !== 'playing') return s
          const last = s.stretches[s.stretches.length - 1]
          return { ...s, stretches: [...s.stretches.slice(0, -1), { ...last, minutes: last.minutes + FAST }] }
        }),
      1000
    )
    return () => window.clearInterval(id)
  }, [stay?.step])

  if (stay?.step === 'held') {
    const left = Math.max(0, HOLD_MINUTES * 60 - Math.floor((at - stay.at) / 1000))
    return (
      <>
        <PageTitle title={c.ui.heldForYou} sub={w(stay.place.name)} />
        <div className='absolute inset-x-[16px] top-[200px] rounded-[28px] p-[24px] text-center text-white' style={{ backgroundColor: 'var(--slab)' }}>
          <Odometer clock value={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`} className='text-[64px] font-extrabold tracking-[-0.03em]' />
          <div className='mt-[4px] text-[14px] opacity-70'>{c.ui.heldNote}</div>
        </div>
        <div className='absolute inset-x-[16px] top-[400px] flex flex-col gap-[10px]'>
          <button
            type='button'
            className='h-[56px] rounded-full text-[16px] font-bold text-white'
            style={{ backgroundColor: 'var(--brand)' }}
            onClick={() => setStay({ step: 'playing', place: stay.place, stretches: [{ rate: 'single', minutes: 0 }], startedAt: now() })}
          >
            {stay.place.rate ? c.ui.imHereClock : c.ui.imHere}
          </button>
          <button type='button' className='h-[52px] rounded-full bg-slate-100 text-[15px] font-semibold' onClick={() => setStay(null)}>
            {c.ui.cancelHold}
          </button>
        </div>
      </>
    )
  }

  if (stay?.step === 'playing') {
    const timed = stay.place.rate !== null
    const tariff = { ...ROOM_TARIFF, single: stay.place.rate ?? 0, multi: Math.round((stay.place.rate ?? 0) * 1.5) }
    const minutes = stay.stretches.reduce((sum, s) => sum + s.minutes, 0)
    const bill = sessionBill(stay.stretches, tariff)
    const rate = stay.stretches[stay.stretches.length - 1].rate
    const setRate = (next: RateId) => next !== rate && setStay({ ...stay, stretches: [...stay.stretches, { rate: next, minutes: 0 }] })
    return (
      <>
        <PageTitle title={w(stay.place.name)} sub={timed ? c.ui.clockRunning : c.ui.seated} />
        {timed ? (
          <>
            <div className='absolute inset-x-[16px] top-[196px] rounded-[28px] p-[22px] text-white' style={{ backgroundColor: 'var(--slab)' }}>
              <div className='flex items-end justify-between'>
                <Odometer clock value={`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`} className='text-[60px] leading-none font-extrabold tracking-[-0.03em]' />
                <Odometer value={`${c.ui.egp} ${bill.total}`} className='pb-[6px] text-[20px] font-bold text-amber-300' />
              </div>
              <div className='mt-[10px] text-[12px] opacity-60'>{c.ui.fastClock}</div>
            </div>
            <div className='absolute inset-x-[16px] top-[352px]'>
              <div className='flex gap-[6px] rounded-[16px] bg-slate-100 p-[4px]'>
                {(['single', 'multi'] as const).map((id) => (
                  <button key={id} type='button' onClick={() => setRate(id)} className={cn('h-[48px] flex-1 rounded-[12px] text-[13px] font-semibold transition-colors', rate === id ? 'bg-white shadow-sm' : 'text-slate-500')}>
                    {id === 'single' ? c.ui.rateSingle : c.ui.rateMulti}
                    <span className='ms-[6px] opacity-60'>{tariff[id]}</span>
                  </button>
                ))}
              </div>
              <div className='mt-[14px] flex flex-col'>
                {bill.lines.map((l) => (
                  <div key={l.rate} className='flex h-[42px] items-center justify-between border-b border-slate-100 text-[15px]'>
                    <span className='font-medium'>
                      {l.rate === 'single' ? c.ui.rateSingle : c.ui.rateMulti}, {l.minutes} {c.ui.min}
                    </span>
                    <span className='font-semibold'>{l.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className='absolute inset-x-[16px] top-[200px] rounded-[28px] bg-slate-100 p-[22px] text-[15px] font-medium text-slate-600'>{c.ui.tableNote}</div>
        )}
        <button type='button' className='absolute inset-x-[16px] bottom-[84px] h-[52px] rounded-full bg-slate-100 text-[15px] font-semibold' onClick={() => setStay(null)}>
          {timed ? c.ui.endSession : c.ui.leaveTable}
        </button>
      </>
    )
  }

  const free = PLACES.filter((p) => p.state === 'free').length
  return (
    <>
      <PageTitle title={c.ui.book} sub={`${free} ${c.ui.freeNow}`} />
      <div className='no-bar absolute inset-x-0 top-[192px] bottom-0 flex flex-col gap-[12px] overflow-y-auto px-[16px] pb-[88px]'>
        {PLACES.map((p) => (
          <div key={p.id} className='flex items-center gap-[12px] rounded-[24px] bg-slate-100 p-[16px]'>
            <div className='min-w-0 flex-1'>
              <div className='text-[17px] font-bold'>{w(p.name)}</div>
              <div className='truncate text-[13px] text-slate-500'>
                {w(p.note)}
                {p.rate ? ` · ${p.rate} ${c.ui.perHour}` : ''}
              </div>
            </div>
            {p.state === 'free' ? (
              <button type='button' className='h-[44px] shrink-0 rounded-full px-[16px] text-[14px] font-bold text-white' style={{ backgroundColor: 'var(--brand)' }} onClick={() => setStay({ step: 'held', place: p, at: now() })}>
                {c.ui.reserve}
              </button>
            ) : (
              <span className='shrink-0 rounded-full bg-white px-[12px] py-[6px] text-[13px] font-semibold text-slate-500'>{p.state === 'occupied' ? c.ui.occupied : c.ui.reserved}</span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ——— You —————————————————————————————————————————————————————————

/** Points as a ring, from client_web's points-ring.tsx: the balance in the middle, the ring as far as the next tier */
function PointsRing({ points, progress, label }: { points: number; progress: number; label: string }) {
  const size = 132
  const stroke = 10
  const r = (size - stroke) / 2
  return (
    <div className='relative grid shrink-0 place-items-center' style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='absolute inset-0 -rotate-90' aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='currentColor' strokeOpacity={0.14} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='#fbbf24'
          strokeWidth={stroke}
          strokeLinecap='round'
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.02, progress) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className='flex flex-col items-center leading-none'>
        <Odometer value={String(points)} className='text-[28px] font-extrabold' />
        <span className='mt-[4px] text-[12px] font-semibold opacity-60'>{label}</span>
      </div>
    </div>
  )
}

function YouTab() {
  const { c } = useLang()
  const points = useCafe((s) => s.points)
  const earned = useCafe((s) => s.orders.filter((o) => o.from === 'phone' && o.where === TABLE && o.stage === 'ready'))
  const { tier, next, progress } = tierOf(points)
  const toNext = next ? TIERS.find((t) => t.id === next)!.from - points : 0
  const rows: { key: string; title: string; when: string; points: number }[] = [
    ...earned.map((o) => ({ key: `o${o.key}`, title: c.ui.orderAtTable, when: c.ui.justNow, points: o.total * POINTS_PER_POUND })).reverse(),
    { key: 'a', title: c.ui.roomTwoHours, when: c.ui.yesterday, points: 240 },
    { key: 'b', title: c.ui.freeLatte, when: c.ui.yesterday, points: -1500 },
  ]
  return (
    <>
      <PageTitle title={c.ui.you} sub='Lina' />
      <div className='absolute inset-x-[16px] top-[192px] flex items-center gap-[18px] rounded-[28px] p-[20px] text-white' style={{ backgroundColor: 'var(--slab)' }}>
        <PointsRing points={points} progress={progress} label={c.ui.points} />
        <div className='min-w-0'>
          <div className='text-[22px] font-extrabold'>{c.ui.tiers[tier]}</div>
          <div className='mt-[4px] text-[13px] leading-[1.4] opacity-70'>{next ? `${toNext} ${c.ui.pointsTo} ${c.ui.tiers[next]}` : c.ui.topTier}</div>
        </div>
      </div>
      <div className='absolute inset-x-[16px] top-[384px]'>
        <div className='text-[17px] font-bold'>{c.ui.recent}</div>
        <div className='mt-[6px] flex flex-col'>
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.div key={r.key} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className='flex h-[56px] items-center justify-between border-b border-slate-100'>
                <div>
                  <div className='text-[15px] font-semibold'>{r.title}</div>
                  <div className='text-[12px] text-slate-500'>{r.when}</div>
                </div>
                <span dir='ltr' className={cn('text-[15px] font-bold', r.points > 0 ? 'text-emerald-600' : 'text-slate-500')}>
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
