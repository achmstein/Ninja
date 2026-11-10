import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Building2, Coffee, Contact, LayoutDashboard, ScanLine, TrendingUp, Warehouse, type LucideIcon } from 'lucide-react'
import { itemById } from '@/cafe/menu'
import { kitchenOrders, useBrand, useCafe } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { spring } from '@/lib/motion'
import { Odometer } from '@/lib/odometer'
import { Browser, Phone } from './frames'

export type DashPage = 'today' | 'menu' | 'stock' | 'profit' | 'team' | 'branches'

const PAGES: { id: DashPage; Icon: LucideIcon }[] = [
  { id: 'today', Icon: LayoutDashboard },
  { id: 'menu', Icon: Coffee },
  { id: 'stock', Icon: Warehouse },
  { id: 'profit', Icon: TrendingUp },
  { id: 'team', Icon: Contact },
  { id: 'branches', Icon: Building2 },
]

const ELEV = '0 0 0 1px rgb(2 6 24 / .06), 0 1px 2px rgb(2 6 24 / .04), 0 2px 6px -2px rgb(2 6 24 / .04)'

/**
 * The owner's dashboard, as admin_web draws it (shadcn, Geist, slate): in a
 * browser window with its sidebar on a wide page, and as the phone it is
 * built for first on a narrow one. Today's numbers are the page's café's own.
 */
export function Dashboard({ page, onPage, narrow, className }: { page: DashPage; onPage: (page: DashPage) => void; narrow?: boolean; className?: string }) {
  const { c } = useLang()
  const brand = useBrand()
  const body = (
    <AnimatePresence mode='wait' initial={false}>
      <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className='flex flex-col gap-[20px]'>
        <div className='text-[24px] leading-[32px] font-semibold tracking-[-0.025em]'>{c.dash.pages[page]}</div>
        {page === 'today' && <Today narrow={narrow} />}
        {page === 'menu' && <MenuScan narrow={narrow} />}
        {page === 'stock' && <Stock narrow={narrow} />}
        {page === 'profit' && <Profit />}
        {page === 'team' && <Team />}
        {page === 'branches' && <Branches />}
      </motion.div>
    </AnimatePresence>
  )

  if (narrow) {
    return (
      <Phone className={className} font='var(--font-sans)'>
        <div className='absolute inset-0 flex flex-col pt-[52px] text-[14px]'>
          <div className='no-bar flex shrink-0 gap-[6px] overflow-x-auto px-[14px] pb-[10px]'>
            {PAGES.map(({ id, Icon }) => (
              <button
                key={id}
                type='button'
                onClick={() => onPage(id)}
                className={cn('flex h-[36px] shrink-0 items-center gap-[6px] rounded-[10px] px-[12px] text-[13px] font-medium', page === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
              >
                <Icon size={15} strokeWidth={1.8} />
                {c.dash.pages[id]}
              </button>
            ))}
          </div>
          <div className='no-bar min-h-0 flex-1 overflow-y-auto px-[14px] pb-[24px]'>{body}</div>
        </div>
      </Phone>
    )
  }

  return (
    <Browser logical={[1180, 700]} address={`admin.${brand.id}.ninjapp.net`} className={className}>
      <div className='absolute inset-0 flex text-[14px] tracking-[-0.006em]'>
        <div className='flex w-[232px] shrink-0 flex-col p-[8px]'>
          <div className='flex h-[48px] items-center gap-[8px] p-[8px]'>
            <span className='grid size-[32px] place-items-center rounded-[8px] bg-slate-950 text-[14px] font-semibold text-white'>{brand.name.charAt(0)}</span>
            <div className='leading-[1.15]'>
              <div className='font-semibold'>{brand.name}</div>
              <div className='text-[12px] text-slate-500'>{c.dash.branch}</div>
            </div>
          </div>
          <div className='mt-[8px] flex flex-col gap-[2px] px-[8px]'>
            {PAGES.map(({ id, Icon }) => (
              <button
                key={id}
                type='button'
                onClick={() => onPage(id)}
                className={cn('flex h-[32px] items-center gap-[8px] rounded-[8px] px-[8px] text-start', page === id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50')}
                style={page === id ? { boxShadow: ELEV } : undefined}
              >
                <Icon size={16} strokeWidth={1.8} />
                {c.dash.pages[id]}
              </button>
            ))}
          </div>
          <div className='mt-auto flex items-center justify-center gap-[6px] pb-[6px] text-[11px] text-slate-500'>
            {c.dash.poweredBy} <span className='text-[15px] opacity-80' style={{ fontFamily: 'var(--font-wordmark)' }}>ninja</span>
          </div>
        </div>
        <div className='no-bar m-[8px] ms-0 min-w-0 flex-1 overflow-y-auto rounded-[14px] bg-white p-[24px]' style={{ boxShadow: ELEV }}>
          {body}
        </div>
      </div>
    </Browser>
  )
}

function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[14px] bg-white p-[20px]', className)} style={{ boxShadow: ELEV }}>
      {title && <div className='mb-[14px] text-[16px] leading-none font-semibold'>{title}</div>}
      {children}
    </div>
  )
}

function Stats({ stats, narrow }: { stats: { label: string; value: string; tone?: string }[]; narrow?: boolean }) {
  return (
    <div className={cn('grid overflow-hidden rounded-[10px] border border-slate-200', narrow ? 'grid-cols-2' : 'grid-flow-col auto-cols-fr')}>
      {stats.map((s) => (
        <div key={s.label} className='border-slate-200 p-[14px] [&:not(:first-child)]:border-s'>
          <div className='text-[12px] font-medium text-slate-500'>{s.label}</div>
          <Odometer value={s.value} className={cn('mt-[4px] text-[20px] font-semibold tracking-[-0.025em]', s.tone)} />
        </div>
      ))}
    </div>
  )
}

const Row = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('flex h-[40px] items-center gap-[12px] border-b border-slate-100 last:border-0', className)}>{children}</div>

// ——— Today: the page's own café —————————————————————————————————

const HOURS = [9, 14, 22, 31, 26, 38, 47, 41, 52]

function Today({ narrow }: { narrow?: boolean }) {
  const { c, w } = useLang()
  const sales = useCafe((s) => s.salesToday)
  const count = useCafe((s) => s.ordersToday)
  // The list is made here, not in the selector: a selector must hand back the same thing for the same state
  const orders = kitchenOrders(useCafe((s) => s.orders))
  // The bar for this hour grows with what the page sells
  const live = Math.min(100, 46 + (sales - 18_450) / 40)
  return (
    <>
      <Stats
        narrow={narrow}
        stats={[
          { label: c.dash.salesToday, value: `${c.ui.egp} ${sales.toLocaleString('en')}` },
          { label: c.dash.orders, value: String(count) },
          { label: c.dash.average, value: `${c.ui.egp} ${Math.round(sales / count)}` },
          { label: c.dash.placesInUse, value: '7 / 12' },
        ]}
      />
      <div className={cn('grid gap-[16px]', narrow ? 'grid-cols-1' : 'grid-cols-[1.3fr_1fr]')}>
        <Card title={c.dash.byHour}>
          <div dir='ltr' className='flex h-[150px] items-end gap-[8px]'>
            {[...HOURS, live].map((v, i) => (
              <div key={i} className='flex flex-1 flex-col items-center gap-[6px]'>
                <div className={cn('w-full rounded-[5px] transition-[height] duration-500', i === HOURS.length ? 'bg-[#4f60e0]' : 'bg-slate-200')} style={{ height: `${v}%` }} />
                <span className='text-[11px] text-slate-500'>{12 + i}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={c.dash.liveOrders}>
          <AnimatePresence initial={false}>
            {orders.slice(-4).reverse().map((o) => (
              <motion.div key={o.key} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
                <Row>
                  <span className='w-[40px] font-medium'>#{o.no}</span>
                  <span className='min-w-0 flex-1 truncate text-slate-600'>{o.lines.map((l) => `${l.qty} ${w(itemById(l.id).name)}`).join(c.ui.comma)}</span>
                  <span className={cn('rounded-full px-[8px] py-[2px] text-[12px] font-medium', o.stage === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{o.stage === 'ready' ? c.ui.ready : c.ui.beingMadeShort}</span>
                </Row>
              </motion.div>
            ))}
          </AnimatePresence>
        </Card>
      </div>
    </>
  )
}

// ——— Menu: a paper menu read into the app —————————————————————————

const SCANNED: { en: string; ar: string; price: number; cat: 0 | 1 }[] = [
  { en: 'Spanish Latte', ar: 'سبانش لاتيه', price: 70, cat: 0 },
  { en: 'Flat White', ar: 'فلات وايت', price: 65, cat: 0 },
  { en: 'Pistachio Latte', ar: 'لاتيه فستق', price: 85, cat: 0 },
  { en: 'San Sebastian Cheesecake', ar: 'تشيز كيك سان سيباستيان', price: 95, cat: 1 },
  { en: 'Molten Chocolate Cake', ar: 'مولتن كيك شوكولاتة', price: 90, cat: 1 },
  { en: 'Kunafa Cup', ar: 'كوب كنافة', price: 75, cat: 1 },
]

function MenuScan({ narrow }: { narrow?: boolean }) {
  const { c } = useLang()
  const reduced = useReducedMotion()
  const [read, setRead] = useState(0)
  const [started, setStarted] = useState(false)
  // Reading while there are lines left to read
  const running = started && read < SCANNED.length
  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => setRead((n) => n + 1), reduced ? 0 : 420)
    return () => window.clearTimeout(id)
  }, [running, read, reduced])
  return (
    <div className={cn('grid gap-[16px]', narrow ? 'grid-cols-1' : 'grid-cols-[1fr_1.15fr]')}>
      <Card>
        <div className='relative overflow-hidden rounded-[10px]'>
          <img src='/paper-menu.webp' alt={c.dash.paperMenuAlt} loading='lazy' className='block w-full' />
          {running && <div aria-hidden className='scan-line absolute inset-x-0 h-[3px] bg-[#4f60e0] shadow-[0_0_18px_4px_rgb(79_96_224/.6)]' />}
        </div>
        <button
          type='button'
          onClick={() => {
            setRead(0)
            setStarted(true)
          }}
          className='mt-[14px] flex h-[40px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#0f172b] text-[14px] font-medium text-white'
        >
          <ScanLine size={16} />
          {read >= SCANNED.length ? c.dash.readAgain : c.dash.readMenu}
        </button>
      </Card>
      <Card title={read > 0 ? `${read} ${c.dash.itemsRead}` : c.dash.nothingRead}>
        {read === 0 && <div className='text-[14px] leading-[1.5] text-slate-500'>{c.dash.scanHint}</div>}
        {[0, 1].map((cat) => {
          const rows = SCANNED.slice(0, read).filter((r) => r.cat === cat)
          if (rows.length === 0) return null
          return (
            <div key={cat} className='mb-[10px]'>
              <div className='mb-[2px] text-[12px] font-medium text-slate-500'>{c.dash.scanCats[cat]}</div>
              {rows.map((r) => (
                <motion.div key={r.en} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
                  <Row>
                    <span className='min-w-0 flex-1 truncate font-medium' dir='ltr'>
                      {r.en}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-slate-600' dir='rtl' style={{ fontFamily: "'IBM Plex Sans Arabic'" }}>
                      {r.ar}
                    </span>
                    <span className='w-[36px] text-end font-medium'>{r.price}</span>
                  </Row>
                </motion.div>
              ))}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ——— Stock: what a dish costs —————————————————————————————————————

const RECIPE = [
  { id: 'beans', grams: '18 g', cost: 16.2 },
  { id: 'milk', grams: '220 ml', cost: 8.8 },
  { id: 'cup', grams: '1', cost: 3.5 },
] as const

const SHELF = [
  { id: 'beans', left: '3.2 kg', days: 2, low: true },
  { id: 'milk', left: '41 L', days: 5, low: false },
  { id: 'cocoa', left: '1.1 kg', days: 3, low: true },
  { id: 'cups', left: '860', days: 9, low: false },
] as const

function Stock({ narrow }: { narrow?: boolean }) {
  const { c } = useLang()
  const [price, setPrice] = useState(75)
  const cost = RECIPE.reduce((sum, r) => sum + r.cost, 0)
  const margin = Math.round(((price - cost) / price) * 100)
  return (
    <div className={cn('grid gap-[16px]', narrow ? 'grid-cols-1' : 'grid-cols-2')}>
      <Card title={c.dash.recipeTitle}>
        {RECIPE.map((r) => (
          <Row key={r.id}>
            <span className='flex-1 font-medium'>{c.dash.stock[r.id]}</span>
            <span className='text-slate-500' dir='ltr'>
              {r.grams}
            </span>
            <span className='w-[52px] text-end' dir='ltr'>
              {r.cost.toFixed(2)}
            </span>
          </Row>
        ))}
        <Row className='font-semibold'>
          <span className='flex-1'>{c.dash.costToMake}</span>
          <span dir='ltr'>{cost.toFixed(2)}</span>
        </Row>
        <div className='mt-[14px] flex items-center gap-[12px]'>
          <label htmlFor='latte-price' className='text-[13px] text-slate-500'>
            {c.dash.sellAt}
          </label>
          <input id='latte-price' type='range' min={40} max={120} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))} className='min-w-0 flex-1 accent-[#4f60e0]' />
          <Odometer value={String(price)} className='w-[34px] text-end font-semibold' />
        </div>
        <div className='mt-[10px] flex items-baseline justify-between'>
          <span className='text-[13px] text-slate-500'>{c.dash.margin}</span>
          <Odometer value={`${margin}%`} className={cn('text-[28px] font-semibold tracking-[-0.03em]', margin < 55 ? 'text-[#e7000b]' : 'text-[#12a05a]')} />
        </div>
      </Card>
      <Card title={c.dash.shelf}>
        {SHELF.map((s) => (
          <Row key={s.id}>
            <span className='flex-1 font-medium'>{c.dash.stock[s.id]}</span>
            <span className='text-slate-500' dir='ltr'>
              {s.left}
            </span>
            <span className={cn('rounded-full px-[8px] py-[2px] text-[12px] font-medium', s.low ? 'bg-red-50 text-[#e7000b]' : 'bg-slate-100 text-slate-600')}>
              {s.days} {c.dash.daysLeft}
            </span>
          </Row>
        ))}
        <div className='mt-[12px] text-[13px] leading-[1.5] text-slate-500'>{c.dash.shelfNote}</div>
      </Card>
    </div>
  )
}

// ——— Profit and loss ——————————————————————————————————————————————

const MONTH = [
  { id: 'sales', amount: 486_200 },
  { id: 'goods', amount: -151_400 },
  { id: 'labour', amount: -96_000 },
  { id: 'expenses', amount: -72_300 },
  { id: 'vat', amount: -59_700 },
] as const

function Profit() {
  const { c } = useLang()
  const profit = MONTH.reduce((sum, m) => sum + m.amount, 0)
  return (
    <Card title={c.dash.month}>
      {MONTH.map((m) => (
        <Row key={m.id} className='h-[46px]'>
          <span className='w-[130px] shrink-0 font-medium'>{c.dash.pnl[m.id]}</span>
          <div className='h-[10px] min-w-0 flex-1 rounded-full bg-slate-100'>
            <div className={cn('h-full rounded-full', m.amount > 0 ? 'bg-[#4f60e0]' : 'bg-slate-300')} style={{ width: `${(Math.abs(m.amount) / MONTH[0].amount) * 100}%` }} />
          </div>
          <span className='w-[84px] shrink-0 text-end' dir='ltr'>
            {m.amount.toLocaleString('en')}
          </span>
        </Row>
      ))}
      <div className='mt-[14px] flex items-baseline justify-between'>
        <span className='font-semibold'>{c.dash.profit}</span>
        <span className='text-[28px] font-semibold tracking-[-0.03em] text-[#12a05a]' dir='ltr'>
          {c.ui.egp} {profit.toLocaleString('en')}
        </span>
      </div>
      <div className='mt-[4px] text-[13px] text-slate-500'>{c.dash.profitNote}</div>
    </Card>
  )
}

// ——— Team —————————————————————————————————————————————————————————

const STAFF = [
  { name: { en: 'Nour', ar: 'نور' }, role: 'cashier', days: 24, pay: 9_600, advance: 1_000 },
  { name: { en: 'Omar', ar: 'عمر' }, role: 'barista', days: 26, pay: 8_840, advance: 0 },
  { name: { en: 'Salma', ar: 'سلمى' }, role: 'kitchen', days: 22, pay: 7_920, advance: 500 },
  { name: { en: 'Karim', ar: 'كريم' }, role: 'rider', days: 25, pay: 6_250, advance: 0 },
] as const

function Team() {
  const { c, w } = useLang()
  return (
    <Card title={c.dash.payslips}>
      <Row className='text-[12px] font-medium text-slate-500'>
        <span className='flex-1'>{c.dash.name}</span>
        <span className='w-[56px] text-end'>{c.dash.days}</span>
        <span className='w-[72px] text-end'>{c.dash.advance}</span>
        <span className='w-[72px] text-end'>{c.dash.net}</span>
      </Row>
      {STAFF.map((s) => (
        <Row key={s.name.en} className='h-[46px]'>
          <span className='flex-1'>
            <span className='font-medium'>{w(s.name)}</span> <span className='text-slate-500'>{c.dash.roles[s.role]}</span>
          </span>
          <span className='w-[56px] text-end'>{s.days}</span>
          <span className='w-[72px] text-end text-slate-500' dir='ltr'>
            {s.advance ? `-${s.advance.toLocaleString('en')}` : '0'}
          </span>
          <span className='w-[72px] text-end font-medium' dir='ltr'>
            {(s.pay - s.advance).toLocaleString('en')}
          </span>
        </Row>
      ))}
      <div className='mt-[12px] text-[13px] leading-[1.5] text-slate-500'>{c.dash.teamNote}</div>
    </Card>
  )
}

// ——— Branches —————————————————————————————————————————————————————

function Branches() {
  const { c } = useLang()
  const sales = useCafe((s) => s.salesToday)
  const rows = [
    { name: c.dash.branchNames[0], amount: sales },
    { name: c.dash.branchNames[1], amount: 14_820 },
    { name: c.dash.branchNames[2], amount: 9_340 },
  ]
  const top = Math.max(...rows.map((r) => r.amount))
  return (
    <Card title={c.dash.salesToday}>
      {rows.map((r) => (
        <Row key={r.name} className='h-[50px]'>
          <span className='w-[110px] shrink-0 font-medium'>{r.name}</span>
          <div className='h-[10px] min-w-0 flex-1 rounded-full bg-slate-100'>
            <div className='h-full rounded-full bg-[#10a58a] transition-[width] duration-500' style={{ width: `${(r.amount / top) * 100}%` }} />
          </div>
          <Odometer value={r.amount.toLocaleString('en')} className='w-[70px] shrink-0 text-end font-medium' />
        </Row>
      ))}
      <div className='mt-[12px] text-[13px] leading-[1.5] text-slate-500'>{c.dash.branchesNote}</div>
    </Card>
  )
}
