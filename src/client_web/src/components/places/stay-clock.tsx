import { motion } from 'motion/react'
import { type StayViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import { hasOptions, PlaceIcon } from '@/lib/places'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'
import { Slab } from '@/components/ninja/page/parts'

/** Seconds on the clock since it started */
function elapsedSeconds(start: string | null | undefined, now: number): number {
  if (!start) return 0
  return Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000))
}

function formatElapsed(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * The running clock as the hero of the tab: the dock's dark slab, the time
 * as the biggest thing on the screen with its digits rolling like the
 * tray's total, a thin line along the bottom filling with each minute, and
 * who is in the room. No money here — the bill carries that.
 */
export function StayClock({
  stay,
  now,
  selfId,
}: {
  stay: StayViewModel
  now: number
  /** The signed-in customer, to mark their own chip */
  selfId?: string
}) {
  const t = useT()
  const localized = useLocalized()
  const seconds = elapsedSeconds(stay.startedAt, now)
  const second = seconds % 60

  // The owner first, then in the order they joined
  const members = [...(stay.members ?? [])].sort((a, b) => (a.role === b.role ? 0 : a.role === 'Owner' ? -1 : 1))

  return (
    <Slab className='isolate flex flex-col gap-5 pb-6'>
      <PlaceIcon kind={Number(stay.placeKind)} className='pointer-events-none absolute -end-8 -top-6 -z-10 size-48 rotate-12 opacity-[0.07]' />

      <div className='flex items-center justify-between gap-3'>
        <span className='flex items-center gap-2 text-[13px] font-semibold'>
          <span className='relative grid size-2.5 place-items-center'>
            <span className='absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none' />
            <span className='size-2 rounded-full bg-emerald-400' />
          </span>
          {t('bookClockRunning')}
        </span>
        {hasOptions(stay.tariff) && stay.currentOptionName && (
          <span className='bg-muted rounded-full px-3 py-1 text-xs font-bold'>{localized(stay.currentOptionName)}</span>
        )}
      </div>

      {/* A clock reads hours first in either language */}
      <div className='text-[3.25rem] leading-none font-extrabold tracking-tight sm:text-6xl'>
        <span dir='ltr' className='inline-block'>
          <Odometer value={formatElapsed(seconds)} />
        </span>
      </div>

      {/* Who is in the room: the owner first, you filled in */}
      {members.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          {members.map((member) => {
            const isSelf = member.customerId === selfId
            const name = member.customerName?.trim() || ''
            return (
              <span
                key={member.customerId ?? name}
                className={cn('rounded-full px-3 py-1 text-xs font-semibold', isSelf ? 'bg-background text-foreground' : 'bg-muted')}
                title={name}
              >
                {isSelf ? t('you') : name.split(' ')[0]}
              </span>
            )
          })}
        </div>
      )}

      {/* The minute filling up; it snaps back empty rather than running backwards */}
      <div aria-hidden className='bg-muted absolute inset-x-0 bottom-0 h-1'>
        <motion.div
          className='h-full origin-left bg-emerald-400 rtl:origin-right'
          initial={false}
          animate={{ scaleX: (second + 1) / 60 }}
          transition={second === 0 ? { duration: 0 } : { duration: 1, ease: 'linear' }}
        />
      </div>
    </Slab>
  )
}
