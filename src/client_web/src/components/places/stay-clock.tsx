import { useLocalized, useT } from '@/lib/i18n'
import { type StayViewModel } from '@/api/spaces'
import { hasOptions } from '@/lib/places'
import { cn } from '@/lib/utils'

function formatElapsed(start: string | null | undefined, now: number): string {
  if (!start) return '00:00:00'
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(start).getTime()) / 1000),
  )
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * The clock card at the top of a running stay: the place and the rate,
 * the time as the biggest thing on the screen, and who is in the room.
 * No money here — the tab below and the receipt at the end carry that.
 */
export function StayClock({
  stay,
  now,
  selfId,
}: {
  stay: StayViewModel
  now: number
  /** The signed-in customer, to mark their own avatar */
  selfId?: string
}) {
  const t = useT()
  const localized = useLocalized()

  // The owner first, then in the order they joined
  const members = [...(stay.members ?? [])].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'Owner' ? -1 : 1,
  )

  return (
    <div className='from-primary to-primary/85 text-primary-foreground flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br p-6 shadow-lg'>
      <div className='flex w-full items-center justify-between'>
        <span className='text-xl font-bold'>{localized(stay.placeName)}</span>
        {hasOptions(stay.tariff) && stay.currentOptionName && (
          <span className='rounded-pill border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold'>
            {localized(stay.currentOptionName)}
          </span>
        )}
      </div>

      <div className='flex flex-col items-center gap-1'>
        <div className='text-5xl font-bold tracking-widest tabular-nums'>
          {formatElapsed(stay.startedAt, now)}
        </div>
      </div>

      {/* Who is in the room: the owner first, you marked */}
      {members.length > 0 && (
        <div className='flex flex-wrap items-center justify-center gap-2'>
          {members.map((member) => {
            const isSelf = member.customerId === selfId
            const name = member.customerName?.trim() || ''
            return (
              <span
                key={member.customerId ?? name}
                className={cn(
                  'rounded-pill px-3 py-1 text-xs font-semibold',
                  // The same chip as the rate pill above; yours filled in
                  isSelf
                    ? 'bg-white text-primary'
                    : 'border border-white/30 bg-white/15',
                )}
                title={name}
              >
                {isSelf ? t('you') : name.split(' ')[0]}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
