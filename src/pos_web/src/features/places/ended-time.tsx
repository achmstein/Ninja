import type { StayViewModel } from '@/api/spaces/types.gen'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import {
  elapsedSeconds,
  formatClock,
  optionSeconds,
  tariffOptions,
} from './status'

/**
 * An ended stay's time where its clock stood, stopped at the whole stay:
 * when it ended under it, and the split by rate once more than one was
 * played. No money: the time is a line on the bill now.
 */
export function EndedTime({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const end = stay.endedAt ? new Date(stay.endedAt).getTime() : Date.now()
  const used = tariffOptions(stay.tariff).filter(
    (o) => optionSeconds(stay, o.code, end) > 0,
  )
  const endedAt = stay.endedAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
        new Date(stay.endedAt),
      )
    : null

  return (
    <div className='min-w-0'>
      <div className='type-figure'>
        {formatClock(elapsedSeconds(stay, end))}
      </div>
      <div className='text-muted-foreground type-body truncate tabular-nums'>
        {endedAt ? `${t('sessionEnded')} · ${endedAt}` : t('sessionEnded')}
      </div>
      {used.length > 1 && (
        <div className='text-muted-foreground type-detail truncate tabular-nums'>
          {used
            .map(
              (o) =>
                `${localized(o.name)} ${formatClock(optionSeconds(stay, o.code, end))}`,
            )
            .join(' · ')}
        </div>
      )}
    </div>
  )
}
