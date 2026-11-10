import { useEffect, useRef, useState } from 'react'
import { incoming, useCafe } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { GuestPhone } from '@/screens/guest-phone'
import { KitchenScreen } from '@/screens/kitchen'
import { Till } from '@/screens/till'
import { ContactButtons, Container } from './chrome'

/** Counts each time `value` goes up: an order arriving somewhere */
function useRise(value: number): number {
  const [n, setN] = useState(0)
  const last = useRef(value)
  useEffect(() => {
    if (value > last.current) setN((x) => x + 1)
    last.current = value
  }, [value])
  return n
}

/** The line an order travels between two screens; a dot runs along it each time `n` counts up */
function Thread({ along, n, className }: { along: 'x' | 'y'; n: number; className?: string }) {
  return (
    <div aria-hidden className={cn('relative rounded-full bg-ink/20', along === 'x' ? 'h-[3px] w-full' : 'mx-auto h-10 w-[3px]', className)}>
      {n > 0 && <span key={n} className={cn('absolute size-[15px] rounded-full bg-ink', along === 'x' ? 'thread-x -top-[6px] -ms-[7px]' : 'thread-y -left-[6px] -mt-[7px]')} />}
    </div>
  )
}

const Label = ({ children }: { children: string }) => <div className='mb-3 text-[0.9375rem] font-semibold text-ink/80'>{children}</div>

/**
 * The first thing on the page is the café itself: a guest's phone, the till
 * and the kitchen screen, wired together and running.
 */
export function Hero() {
  const { c } = useLang()
  const touched = useCafe((s) => s.touched)
  const reset = useCafe((s) => s.reset)
  const toTill = useRise(useCafe((s) => incoming(s.orders).length))
  const toKitchen = useRise(useCafe((s) => s.ordersToday))
  return (
    <section>
      <Container className='pt-6 pb-10 sm:pt-12 sm:pb-14'>
        <p className='text-[0.9375rem] font-semibold text-soft'>{c.hero.kicker}</p>
        <h1 className='display mt-4 max-w-[13ch] text-[clamp(2.9rem,9.2vw,7.25rem)]'>{c.hero.title}</h1>
        <div className='mt-7 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between'>
          <p className='max-w-[54ch] text-[1.0625rem] leading-relaxed text-soft sm:text-xl sm:leading-relaxed'>{c.hero.lead}</p>
          <div className='flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3'>
            <ContactButtons />
            <a href='#everything' className='text-base font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink'>
              {c.hero.see}
            </a>
          </div>
        </div>
      </Container>

      <div className='px-3 sm:px-6'>
        <div className='mx-auto max-w-[1400px] rounded-[28px] bg-counter px-4 py-8 sm:rounded-[44px] sm:px-10 sm:py-12'>
          <div className='mx-auto grid max-w-[1180px] items-center lg:grid-cols-[minmax(0,300px)_56px_minmax(0,1fr)]'>
            <div className='mx-auto w-full max-w-[300px]'>
              <Label>{c.hero.labels.guest}</Label>
              <GuestPhone />
            </div>
            <Thread along='x' n={toTill} className='hidden lg:block' />
            <Thread along='y' n={toTill} className='my-4 lg:hidden' />
            <div>
              <Label>{c.hero.labels.till}</Label>
              <Till className='hidden lg:block' />
              <Till narrow className='lg:hidden' />
              <Thread along='y' n={toKitchen} className='my-4' />
              <Label>{c.hero.labels.kitchen}</Label>
              <KitchenScreen size='strip' className='hidden lg:block' />
              <KitchenScreen size='narrow' className='lg:hidden' />
            </div>
          </div>
          <div className='mx-auto mt-8 flex max-w-[1180px] flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem] font-medium text-ink/80' aria-live='polite'>
            <span>{touched ? c.hero.yours : c.hero.playing}</span>
            {touched && (
              <button type='button' onClick={reset} className='font-semibold underline decoration-ink/40 underline-offset-4 hover:decoration-ink'>
                {c.hero.replay}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
