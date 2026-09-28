import { ChevronUp } from 'lucide-react'
import { type StayViewModel } from '@/api/spaces'
import { formatClock, useSecondTick } from '@/lib/clock'
import { useDockSheet } from '@/lib/dock-sheet'
import { useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { Odometer } from '@/components/ninja/odometer'

/**
 * The Book tab while the customer's clock runs: a slim card over the places
 * to book, saying where they are and for how long. A tap opens the room the
 * way the dock's row does, the same sheet, so the room lives in one place.
 */
export function StayBanner({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const now = useSecondTick()
  const open = useDockSheet((s) => s.setOpen)
  const since = stay.startedAt ? new Date(stay.startedAt).getTime() : now

  return (
    <button
      type='button'
      onClick={() => open(true)}
      className='slab flex w-full items-center gap-3 rounded-[1.5rem] p-3 ps-4 text-start transition-transform active:scale-[0.98] motion-reduce:transform-none'
    >
      <span className='bg-background/12 relative grid size-11 shrink-0 place-items-center rounded-full'>
        <PlaceIcon kind={Number(stay.placeKind)} className='size-5' />
        <span className='absolute end-0.5 top-0.5 grid size-2 place-items-center'>
          <span className='absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none' />
          <span className='size-1.5 rounded-full bg-emerald-400' />
        </span>
      </span>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate text-caption opacity-70'>{t('ninjaYoureIn', { name: localized(stay.placeName) })}</span>
        <span dir='ltr' className='self-start text-name font-bold rtl:self-end'>
          <Odometer value={formatClock((now - since) / 1000)} />
        </span>
      </span>
      <ChevronUp className='me-1 size-5 opacity-70' />
    </button>
  )
}
