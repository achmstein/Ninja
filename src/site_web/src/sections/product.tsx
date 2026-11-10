import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BRANDS, type BrandId, type Lang } from '@/cafe/menu'
import { useCafe } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { now } from '@/lib/clock'
import { LangProvider, useLang } from '@/lib/lang'
import { springSoft } from '@/lib/motion'
import { AssistantChat } from '@/screens/assistant'
import { Dashboard, type DashPage } from '@/screens/dashboard'
import { GuestPhone, type GuestTab, type MenuLayout } from '@/screens/guest-phone'
import { KitchenScreen } from '@/screens/kitchen'
import { RiderPhone, type RiderStep } from '@/screens/rider'
import { Till } from '@/screens/till'
import { Choice, Container, Facts, Head } from './chrome'

/** A list of things to look at, one open at a time: its line of explanation shows under the one chosen */
function Picker<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { id: T; title: string; text: string }[] }) {
  return (
    <div className='border-b border-ink/10'>
      {items.map((item) => {
        const on = item.id === value
        return (
          <div key={item.id} className='border-t border-ink/10'>
            <button type='button' aria-expanded={on} onClick={() => onChange(item.id)} className={cn('flex min-h-14 w-full items-center gap-3 py-3 text-start text-lg font-semibold transition-colors', !on && 'text-soft hover:text-ink')}>
              <span className={cn('size-2.5 shrink-0 rounded-full transition-colors', on ? 'bg-counter ring-2 ring-ink' : 'bg-ink/20')} />
              {item.title}
            </button>
            {on && <p className='max-w-[52ch] ps-[1.375rem] pb-5 text-[0.9375rem] leading-relaxed text-soft sm:text-base'>{item.text}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ——— It looks like your place ————————————————————————————————————

export function BrandSection() {
  const { c, lang } = useLang()
  const brand = useCafe((s) => s.brand)
  const { setBrand, touch } = useCafe.getState()
  const [layout, setLayout] = useState<MenuLayout>('list')
  const [phoneLang, setPhoneLang] = useState<Lang>(lang)
  return (
    <section id='features' className='scroll-mt-8 py-20 sm:py-28'>
      <Container className='grid items-center gap-12 lg:grid-cols-[1fr_320px] lg:gap-20'>
        <div>
          <Head title={c.brand.title} lead={c.brand.lead} />
          <div className='mt-9 grid max-w-[560px] gap-5'>
            <div role='group' aria-label={c.brand.business} className='grid grid-cols-2 gap-2'>
              {BRANDS.map((b) => (
                <button
                  key={b.id}
                  type='button'
                  aria-pressed={brand === b.id}
                  onClick={() => {
                    touch()
                    setBrand(b.id as BrandId)
                  }}
                  className={cn('flex min-h-[4.5rem] flex-col items-start justify-center rounded-2xl px-4 text-start transition-colors', brand === b.id ? 'bg-white shadow-sm ring-2 ring-ink' : 'bg-ink/[0.06] hover:bg-ink/10')}
                >
                  <span
                    dir='ltr'
                    className='text-xl leading-tight'
                    style={{ fontFamily: `'${b.logoFont}', cursive`, fontStyle: b.logoItalic ? 'italic' : undefined, fontWeight: b.logoItalic ? 700 : 400, textTransform: b.logoUpper ? 'uppercase' : undefined, color: b.primary }}
                  >
                    {b.name}
                  </span>
                  <span className='text-[0.8125rem] font-medium text-soft'>{b.kind[lang]}</span>
                </button>
              ))}
            </div>
            <Choice label={c.brand.layout} value={layout} onChange={setLayout} options={[{ id: 'list', label: c.brand.layouts.list }, { id: 'tiles', label: c.brand.layouts.tiles }]} />
            <Choice label={c.brand.language} value={phoneLang} onChange={setPhoneLang} options={[{ id: 'en', label: c.brand.languages.en }, { id: 'ar', label: c.brand.languages.ar }]} />
          </div>
          <Facts items={c.brand.facts} className='mt-9' />
        </div>
        <div className='mx-auto w-full max-w-[320px]'>
          <LangProvider lang={phoneLang}>
            <GuestPhone layout={layout} />
          </LangProvider>
        </div>
      </Container>
    </section>
  )
}

// ——— From their seat —————————————————————————————————————————————

type Scene = 'order' | 'bill' | 'rooms' | 'points'
const SCENE_TAB: Record<Scene, GuestTab> = { order: 'menu', bill: 'menu', rooms: 'book', points: 'you' }

export function GuestSection() {
  const { c } = useLang()
  const [scene, setScene] = useState<Scene>('bill')
  return (
    <section className='py-20 sm:py-28'>
      <Container className='grid items-center gap-12 lg:grid-cols-[320px_1fr] lg:gap-20'>
        <div className='order-2 mx-auto w-full max-w-[320px] lg:order-1'>
          {/* A new phone for each scene: it opens where the scene is */}
          <GuestPhone key={scene} tab={SCENE_TAB[scene]} bill={scene === 'bill'} />
        </div>
        <div className='order-1 lg:order-2'>
          <Head title={c.guest.title} lead={c.guest.lead} />
          <div className='mt-9 max-w-[560px]'>
            <Picker value={scene} onChange={setScene} items={(['order', 'bill', 'rooms', 'points'] as const).map((id) => ({ id, ...c.guest.scenes[id] }))} />
          </div>
        </div>
      </Container>
    </section>
  )
}

// ——— The till and the kitchen ————————————————————————————————————

export function TeamSection() {
  const { c } = useLang()
  const online = useCafe((s) => s.online)
  const { setOnline, touch } = useCafe.getState()
  return (
    <section className='py-20 sm:py-28'>
      <Container>
        <div className='grid items-end gap-10 lg:grid-cols-[1fr_400px] lg:gap-20'>
          <div className='flex items-start gap-4'>
            <img src='/app-icons/pos.svg' alt='' width={52} height={52} className='mt-1 hidden rounded-[14px] sm:block' />
            <Head title={c.team.title} lead={c.team.lead} />
          </div>
          <div>
            <button
              type='button'
              aria-pressed={!online}
              onClick={() => {
                touch()
                setOnline(!online, now())
              }}
              className={cn('inline-flex min-h-13 items-center gap-3 rounded-full px-6 text-base font-semibold transition-colors', online ? 'bg-ink text-white' : 'bg-counter text-ink ring-2 ring-ink')}
            >
              <span className={cn('size-2.5 rounded-full', online ? 'bg-emerald-400' : 'bg-red-600')} />
              {online ? c.team.plug : c.team.plugBack}
            </button>
            <p className='mt-4 max-w-[46ch] text-[0.9375rem] leading-relaxed text-soft'>{c.team.plugNote}</p>
          </div>
        </div>
        <div className='mt-12 grid items-start gap-10 lg:grid-cols-[1fr_300px] lg:gap-14'>
          <div>
            <Till className='hidden md:block' />
            <Till narrow className='mx-auto max-w-[460px] md:hidden' />
          </div>
          <Facts items={c.team.facts} />
        </div>

        <div className='mt-24 grid items-center gap-10 lg:grid-cols-[400px_1fr] lg:gap-16'>
          <div className='flex items-start gap-4'>
            <img src='/app-icons/kds.svg' alt='' width={52} height={52} className='mt-1 hidden rounded-[14px] sm:block' />
            <div>
              <h3 className='display text-[clamp(1.7rem,3.4vw,2.6rem)]'>{c.team.kitchenTitle}</h3>
              <p className='mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-soft'>{c.team.kitchenLead}</p>
            </div>
          </div>
          <div>
            <KitchenScreen className='hidden md:block' />
            <KitchenScreen size='narrow' className='mx-auto max-w-[460px] md:hidden' />
          </div>
        </div>
      </Container>
    </section>
  )
}

// ——— Delivery ————————————————————————————————————————————————————

/** Where the rider is on the map at each step, along the road from the branch to the door */
const ROAD = 'M 92 236 C 150 236, 150 150, 214 150 S 300 96, 322 78'
const RIDER_AT: Record<RiderStep, number> = { assigned: 0, picked: 0.04, onWay: 0.6, delivered: 1 }

function DeliveryMap({ step }: { step: RiderStep }) {
  const { c } = useLang()
  const reduced = useReducedMotion()
  return (
    <div className='overflow-hidden rounded-[28px] bg-[#e7ecef]'>
      <svg viewBox='0 0 400 320' role='img' aria-label={c.delivery.mapLabel} className='block w-full'>
        {/* Streets */}
        <g stroke='#fff' strokeWidth='10' strokeLinecap='round' fill='none'>
          <path d='M-10 70 H410 M-10 160 H410 M-10 250 H410 M70 -10 V330 M190 -10 V330 M310 -10 V330' />
        </g>
        <path d='M-10 300 C 120 280, 260 330, 410 290 V330 H-10 Z' fill='#cfe3ee' />
        {/* The area the branch delivers to, as the owner draws it */}
        <polygon points='40,118 150,52 330,40 372,150 318,270 150,292 52,236' fill='rgb(13 148 136 / .14)' stroke='#0d9488' strokeWidth='2.5' strokeDasharray='7 6' strokeLinejoin='round' />
        <path d={ROAD} fill='none' stroke='#0f172a' strokeOpacity='.25' strokeWidth='3' strokeDasharray='2 7' strokeLinecap='round' />
        <motion.path d={ROAD} fill='none' stroke='#0d9488' strokeWidth='4' strokeLinecap='round' initial={false} animate={{ pathLength: RIDER_AT[step] }} transition={reduced ? { duration: 0 } : springSoft} />
        {/* The branch */}
        <g transform='translate(92 236)'>
          <circle r='15' fill='#0f172a' />
          <path d='M-6 -2 L0 -7 L6 -2 V6 H-6 Z' fill='#fff' />
        </g>
        {/* The guest's door */}
        <g transform='translate(322 78)'>
          <path d='M0 14 C -12 0, -12 -16, 0 -16 C 12 -16, 12 0, 0 14 Z' fill='#f59e0b' stroke='#0f172a' strokeWidth='2' />
          <circle cy='-5' r='4' fill='#0f172a' />
        </g>
        {/* The rider, moved along the road by the same share as the line */}
        <motion.g initial={false} animate={{ offsetDistance: `${RIDER_AT[step] * 100}%` }} transition={reduced ? { duration: 0 } : springSoft} style={{ offsetPath: `path('${ROAD}')`, offsetRotate: '0deg' }}>
          <circle r='11' fill='#0d9488' stroke='#fff' strokeWidth='3' />
        </motion.g>
      </svg>
      <ul className='flex flex-wrap gap-x-5 gap-y-1 px-5 py-4 text-[0.8125rem] font-medium text-soft'>
        <li className='flex items-center gap-2'>
          <span className='size-3 rounded-[3px] border-2 border-dashed border-rider bg-rider/15' />
          {c.delivery.legend.area}
        </li>
        <li className='flex items-center gap-2'>
          <span className='size-3 rounded-full bg-ink' />
          {c.delivery.legend.shop}
        </li>
        <li className='flex items-center gap-2'>
          <span className='size-3 rounded-full bg-amber-500' />
          {c.delivery.legend.door}
        </li>
      </ul>
    </div>
  )
}

export function DeliverySection() {
  const { c } = useLang()
  const [step, setStep] = useState<RiderStep>('assigned')
  return (
    <section className='py-20 sm:py-28'>
      <Container className='grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,560px)] lg:gap-16'>
        <div>
          <div className='flex items-start gap-4'>
            <img src='/app-icons/rider.svg' alt='' width={52} height={52} className='mt-1 hidden rounded-[14px] sm:block' />
            <Head title={c.delivery.title} lead={c.delivery.lead} />
          </div>
          <Facts items={c.delivery.facts} className='mt-9' />
        </div>
        <div className='grid items-center gap-6 sm:grid-cols-[minmax(0,250px)_1fr]'>
          <div className='mx-auto w-full max-w-[280px]'>
            <RiderPhone step={step} onStep={setStep} />
          </div>
          <DeliveryMap step={step} />
        </div>
      </Container>
    </section>
  )
}

// ——— The owner's side ————————————————————————————————————————————

export function OwnerSection() {
  const { c } = useLang()
  const [page, setPage] = useState<DashPage>('today')
  const pages = ['today', 'menu', 'stock', 'profit', 'team', 'branches'] as const
  return (
    <section className='py-20 sm:py-28'>
      <Container>
        <Head title={c.owner.title} lead={c.owner.lead} />
        <div className='mt-12 grid items-start gap-10 lg:grid-cols-[340px_1fr] lg:gap-12'>
          <Picker value={page} onChange={setPage} items={pages.map((id) => ({ id, title: c.dash.pages[id], text: c.owner.pages[id] }))} />
          <div>
            <Dashboard page={page} onPage={setPage} className='hidden lg:block' />
            <Dashboard narrow page={page} onPage={setPage} className='mx-auto max-w-[340px] lg:hidden' />
          </div>
        </div>
      </Container>
    </section>
  )
}

// ——— Ask your café anything ——————————————————————————————————————

export function AssistantSection() {
  const { c } = useLang()
  return (
    <section className='px-3 sm:px-6'>
      <div className='mx-auto max-w-[1400px] rounded-[28px] bg-night py-16 text-white sm:rounded-[44px] sm:py-24'>
        <Container className='grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-16'>
          <div>
            <h2 className='display max-w-[14ch] text-[clamp(2.1rem,5.2vw,3.9rem)]'>{c.assistant.title}</h2>
            <p className='mt-5 max-w-[54ch] text-[1.0625rem] leading-relaxed text-white/70 sm:text-lg'>{c.assistant.lead}</p>
            <ul className='mt-9 max-w-[52ch] border-b border-white/15'>
              {c.assistant.facts.map((fact) => (
                <li key={fact} className='border-t border-white/15 py-3 text-[0.9375rem] leading-snug font-medium text-white/90'>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
          <AssistantChat />
        </Container>
      </div>
    </section>
  )
}
