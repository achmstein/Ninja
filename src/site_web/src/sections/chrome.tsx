import type { ReactNode } from 'react'
import { mailto, whatsappLink } from '@/content/contact'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'

/** The N mark's path, as in /brand/ninja-mark.svg */
export const N_PATH =
  'M49.03 14.8Q49.03 14.8 49.03 15.77Q49.03 16.74 48.99 18.44Q48.96 20.13 48.88 22.42Q48.81 24.72 48.68 27.38Q48.55 30.05 48.35 32.93Q48.16 35.82 47.85 38.69Q47.55 41.56 47.16 44.29Q46.78 47.02 46.24 49.35L41.61 49.54Q40.4 47.72 38.9 45.42Q37.39 43.12 35.76 40.58Q34.12 38.05 32.44 35.42Q30.75 32.79 29.2 30.32Q25.54 24.52 21.66 18.36Q21.54 24.96 21.49 30.92Q21.47 33.47 21.47 36.11Q21.47 38.75 21.48 41.2Q21.49 43.65 21.55 45.76Q21.61 47.87 21.71 49.35L16.55 50Q16.16 47.96 15.89 45.37Q15.62 42.78 15.44 39.92Q15.26 37.05 15.16 34.08Q15.07 31.12 15.02 28.3Q14.92 21.73 15.02 14.75L24.69 14L42.02 44.08Q42.29 40.93 42.34 37.31Q42.39 33.68 42.25 29.83Q42.12 25.98 41.81 22.02Q41.49 18.07 41.03 14.24Z'

/** The N on a rounded square of an app's colour */
export function NMark({ size = 36, color = '#18181b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 64 64' aria-hidden className='shrink-0'>
      <rect width='64' height='64' rx='14' fill={color} />
      <path d={N_PATH} fill='#fafafa' />
    </svg>
  )
}

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('mx-auto w-full max-w-[1240px] px-5 sm:px-8', className)}>{children}</div>

/** A section's heading and what it says under it */
export function Head({ title, lead, className }: { title: string; lead?: string; className?: string }) {
  return (
    <div className={className}>
      <h2 className='display max-w-[18ch] text-[clamp(2.1rem,5.2vw,3.9rem)]'>{title}</h2>
      {lead && <p className='mt-5 max-w-[56ch] text-[1.0625rem] leading-relaxed text-soft sm:text-lg'>{lead}</p>}
    </div>
  )
}

/** Plain facts, one to a line, ruled apart */
export function Facts({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('max-w-[52ch] border-b border-ink/10', className)}>
      {items.map((item) => (
        <li key={item} className='border-t border-ink/10 py-3 text-[0.9375rem] leading-snug font-medium'>
          {item}
        </li>
      ))}
    </ul>
  )
}

/** A choice between a few things, as a row of buttons */
export function Choice<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { id: T; label: ReactNode }[]; onChange: (value: T) => void; className?: string }) {
  return (
    <div role='group' aria-label={label} className={cn('flex flex-wrap gap-1 rounded-2xl bg-ink/[0.06] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type='button'
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn('min-h-11 flex-1 rounded-xl px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors', value === o.id ? 'bg-white shadow-sm' : 'text-soft hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The way to reach Ninja: WhatsApp when the page has a number, and email */
export function ContactButtons({ light, className }: { light?: boolean; className?: string }) {
  const { c } = useLang()
  const whatsapp = whatsappLink(c.cta.whatsappText)
  const main = cn('inline-flex min-h-13 items-center rounded-full px-7 text-base font-semibold transition-transform active:scale-[0.97]', light ? 'bg-white text-ink' : 'bg-ink text-white')
  const second = cn('inline-flex min-h-13 items-center rounded-full px-7 text-base font-semibold ring-1 transition-colors', light ? 'text-white ring-white/30 hover:bg-white/10' : 'ring-ink/20 hover:bg-ink/5')
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {whatsapp ? (
        <>
          <a className={main} href={whatsapp} target='_blank' rel='noreferrer'>
            {c.cta.whatsapp}
          </a>
          <a className={second} href={mailto(c.cta.subject)}>
            {c.cta.email}
          </a>
        </>
      ) : (
        <a className={main} href={mailto(c.cta.subject)}>
          {c.hero.cta}
        </a>
      )}
    </div>
  )
}

export function Header() {
  const { c } = useLang()
  return (
    <header className='py-5'>
      <Container className='flex items-center gap-4'>
        <a href={c.nav.otherLang === 'ar' ? '/' : '/ar'} aria-label={c.nav.home} className='flex items-center gap-2.5'>
          <NMark />
          <span dir='ltr' className='text-[1.7rem] leading-none' style={{ fontFamily: 'var(--font-wordmark)' }}>
            ninja
          </span>
        </a>
        <nav className='ms-auto flex items-center gap-1 text-[0.9375rem] font-medium sm:gap-2'>
          <a href='#features' className='hidden rounded-full px-3 py-2 hover:bg-ink/5 md:block'>
            {c.nav.features}
          </a>
          <a href='#plans' className='hidden rounded-full px-3 py-2 hover:bg-ink/5 md:block'>
            {c.nav.plans}
          </a>
          <a href='/apps' className='hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:block'>
            {c.nav.apps}
          </a>
          <a href={c.nav.otherHref} lang={c.nav.otherLang} hrefLang={c.nav.otherLang} className='rounded-full px-3 py-2 hover:bg-ink/5'>
            {c.nav.other}
          </a>
          <a href='#talk' className='rounded-full bg-ink px-4 py-2.5 text-white'>
            {c.nav.talk}
          </a>
        </nav>
      </Container>
    </header>
  )
}

export function Footer() {
  const { c } = useLang()
  return (
    <footer className='py-10 text-[0.9375rem] text-soft'>
      <Container className='flex flex-wrap items-center justify-between gap-4'>
        <span dir='ltr'>{c.footer.rights}</span>
        <nav className='flex flex-wrap gap-x-6 gap-y-2'>
          <a href='/apps' className='hover:text-ink'>
            {c.footer.apps}
          </a>
          <a href='/privacy' className='hover:text-ink'>
            {c.footer.privacy}
          </a>
          <a href='/terms' className='hover:text-ink'>
            {c.footer.terms}
          </a>
          <a href='/support' className='hover:text-ink'>
            {c.footer.support}
          </a>
        </nav>
      </Container>
    </footer>
  )
}
