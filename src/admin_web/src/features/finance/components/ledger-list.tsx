import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { sourceLabel } from '../format'

type LedgerLine = {
  id: number | string
  label: string
  signed: number | string
  date: string
  note?: string | null
  source: number | string
  recordedBy: string
}

/**
 * An account's lines, newest first, each with its label, note, day and
 * where it came from, and the signed amount on the end.
 */
export function LedgerList({
  lines,
  emptyMessage,
}: {
  lines: LedgerLine[]
  emptyMessage: string
}) {
  const t = useT()
  const locale = useLocale()
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  if (lines.length === 0) {
    return <p className='text-muted-foreground text-sm'>{emptyMessage}</p>
  }

  return (
    <ul className='divide-y text-sm'>
      {lines.map((line) => {
        const signed = toNumber(line.signed)
        return (
          <li
            key={String(line.id)}
            className='flex items-start justify-between gap-3 py-2'
          >
            <div className='min-w-0'>
              <div className='font-medium'>
                {line.label}
                {line.note && (
                  <span className='text-muted-foreground font-normal'>
                    {' '}
                    · {line.note}
                  </span>
                )}
              </div>
              <div className='text-muted-foreground text-xs'>
                {dateFormat.format(new Date(line.date))} ·{' '}
                {sourceLabel(line.source, line.recordedBy, t)}
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 tabular-nums',
                signed > 0 ? 'text-success' : 'text-muted-foreground'
              )}
            >
              {signed > 0 ? '+' : signed < 0 ? '−' : ''}
              {formatEgp(Math.abs(signed))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
