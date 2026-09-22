import { CalendarPlus } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import {
  canHold,
  hasOptions,
  PlaceIcon,
  placeStatusMeta,
  tariffOptions,
} from '@/lib/places'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface PlaceRowProps {
  place: PlaceViewModel
  canReserve: boolean
  onReserve: (place: PlaceViewModel) => void
}

/** One timed place as the list shows it, mirroring the app: icon tile by
 *  kind, name/description, the rates + status, and a reserve button when
 *  it can be held. */
export function PlaceRow({ place, canReserve, onReserve }: PlaceRowProps) {
  const t = useT()
  const localized = useLocalized()

  const status =
    placeStatusMeta[Number(place.status ?? 0)] ?? placeStatusMeta[1]
  const isAvailable = canHold(place) && canReserve
  // A plain table has no rate: the status then starts the line, with no gap or bullet before it
  const hasRate = tariffOptions(place.tariff).length > 0

  return (
    <button
      type='button'
      className='flex w-full items-center gap-3 border-b py-3.5 text-start last:border-b-0'
      disabled={!isAvailable}
      onClick={() => onReserve(place)}
    >
      <div
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-lg',
          isAvailable ? 'bg-primary/10' : 'bg-muted',
        )}
      >
        <PlaceIcon
          kind={Number(place.kind)}
          className={cn(
            'h-7 w-7',
            isAvailable ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='text-[15px] font-semibold'>{localized(place.name)}</div>
        {place.description && (
          <p className='text-muted-foreground line-clamp-2 text-[13px]'>
            {localized(place.description)}
          </p>
        )}
        <div className='mt-1 flex items-center gap-2 text-sm'>
          {hasRate && (
            <span className='font-bold'>
              <TariffLine place={place} />
            </span>
          )}
          <span className={cn('text-[13px]', status.className)}>
            {hasRate && '• '}
            {t(status.key)}
          </span>
        </div>
      </div>

      {isAvailable && (
        <span className='bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full'>
          <CalendarPlus className='h-4 w-4' />
        </span>
      )}
    </button>
  )
}

/** The rate: one figure for a one-rate place, one per option when there is
 *  a choice ("Single £50 · Multi £80 /hr"). */
export function TariffLine({
  place,
}: {
  place: Pick<PlaceViewModel, 'tariff'>
}) {
  const t = useT()
  const localized = useLocalized()
  const options = tariffOptions(place.tariff)
  if (options.length === 0) return null
  if (!hasOptions(place.tariff)) {
    return (
      <>
        {t('hourlyRateFormat', {
          rate: String(Number(options[0].hourlyRate ?? 0)),
        })}
      </>
    )
  }
  return (
    <>
      {options
        .map((o) =>
          t('optionRateFormat', {
            option: localized(o.name),
            rate: String(Number(o.hourlyRate ?? 0)),
          }),
        )
        .join(' · ')}{' '}
      {t('perHourShort')}
    </>
  )
}

/** Loading placeholder for PlaceRow, repeating its container classes so the
 *  list does not resize when the real rows arrive. */
export function PlaceRowSkeleton() {
  return (
    <div className='flex w-full items-center gap-3 border-b py-3.5 last:border-b-0'>
      <Skeleton className='size-16 shrink-0 rounded-lg' />
      <div className='min-w-0 flex-1 space-y-2'>
        <Skeleton className='h-4 w-1/3' />
        <Skeleton className='h-3 w-3/4' />
        <Skeleton className='h-4 w-24' />
      </div>
    </div>
  )
}
