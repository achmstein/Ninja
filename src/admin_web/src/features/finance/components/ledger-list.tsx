import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { When } from '@/components/when'
import { FINANCE_SOURCE, sourceLabel } from '../format'

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
 * where it came from (the till, a receipt, a repeat; a line keyed in by
 * hand says nothing more), and the signed amount on the end.
 */
export function LedgerList({
  lines,
  emptyMessage,
}: {
  lines: LedgerLine[]
  emptyMessage: string
}) {
  const t = useT()

  if (lines.length === 0) {
    return <p className='text-muted-foreground text-sm'>{emptyMessage}</p>
  }

  return (
    <ul className='divide-y text-sm'>
      {lines.map((line) => {
        const signed = toNumber(line.signed)
        const from =
          toNumber(line.source) === FINANCE_SOURCE.manual
            ? ''
            : sourceLabel(line.source, line.recordedBy, t)
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
                <When value={line.date} mode='date' />
                {from && ` · ${from}`}
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
