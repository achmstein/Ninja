import { BatteryFull, Signal, Wifi } from 'lucide-react'
import type { Scheme } from '@/lib/brand-slots'
import { cn } from '@/lib/utils'

/** The viewport the customer app is laid out at, in CSS pixels: a current phone. */
export const PHONE = { width: 390, height: 844, statusBar: 47 } as const

/** How wide the phone is drawn on the page; the app inside is scaled down to it, as a phone in the hand looks. */
const SCREEN_WIDTH = 300
const BEZEL = 7

/**
 * A phone around whatever the customer app looks like: the mock drawn from
 * the draft, or the real app in a frame. The children get a real phone's
 * viewport (390×844 CSS px) under a status bar and an island, and the whole
 * screen is scaled to a phone's size on the page, so text and spacing read
 * as they do in the hand rather than at desktop size.
 */
export function PhoneFrame({ children, scheme, className }: { children: React.ReactNode; scheme: Scheme; className?: string }) {
  const scale = SCREEN_WIDTH / PHONE.width
  const dark = scheme === 'dark'

  return (
    <div
      className={cn('mx-auto shrink-0 rounded-[2.9rem] bg-zinc-900 shadow-xl ring-1 ring-black/40 dark:bg-zinc-800 dark:ring-white/10', className)}
      style={{ width: SCREEN_WIDTH + BEZEL * 2, padding: BEZEL }}
    >
      <div
        className={cn('relative overflow-hidden rounded-[2.45rem]', dark ? 'bg-black' : 'bg-white')}
        style={{ width: SCREEN_WIDTH, height: PHONE.height * scale }}
      >
        {/* The app's viewport, laid out at phone size and scaled to the screen; physical left so RTL content stays put */}
        <div
          dir='ltr'
          className='absolute top-0 left-0 origin-top-left'
          style={{ width: PHONE.width, height: PHONE.height, transform: `scale(${scale})` }}
        >
          <div
            className={cn(
              'relative flex items-center justify-between px-8 text-[15px] font-semibold',
              dark ? 'bg-black text-white' : 'bg-white text-black'
            )}
            style={{ height: PHONE.statusBar }}
          >
            <span className='w-14 tabular-nums'>9:41</span>
            <div className='absolute top-2.5 left-1/2 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black' />
            <span className='flex w-14 items-center justify-end gap-1'>
              <Signal className='size-3.5' />
              <Wifi className='size-3.5' />
              <BatteryFull className='size-4' />
            </span>
          </div>
          <div className='relative overflow-hidden' style={{ height: PHONE.height - PHONE.statusBar }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
