import { type ShiftView } from '@/api/sales'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { StatTile } from './stat-tile'
import { tenderLabelKey } from './tender'

/**
 * Over/short verdict badge: green when the drawer is over or balanced,
 * red when short. Shared by the report and the closed-shift rows.
 */
export function OverShortBadge({ value }: { value: number }) {
  const t = useT()
  return (
    <Badge
      className={cn(
        'border-transparent tabular-nums',
        value >= 0
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/15 text-destructive'
      )}
    >
      {value === 0
        ? t('drawerBalanced')
        : `${t(value > 0 ? 'drawerOver' : 'drawerShort')} ${formatEgp(Math.abs(value))}`}
    </Badge>
  )
}

/**
 * The shift figures as the till prints them: the live X view of an open
 * shift leads with what should be in the drawer; a closed one leads with the
 * frozen expected-vs-counted verdict. Read-only here — the drawer is opened,
 * moved and counted from the till.
 */
export function ShiftReport({ shift }: { shift: ShiftView }) {
  const t = useT()
  const locale = useLocale()

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''

  const closed = shift.status === 'Closed'
  const overShort = toNumber(shift.overShort)
  const tenders = shift.tenderTotals ?? []
  const movements = shift.movements ?? []

  return (
    <div className='flex flex-col gap-4'>
      {closed ? (
        <div className='bg-accent grid grid-cols-3 gap-2 rounded-xl p-4 text-center'>
          <div>
            <div className='text-muted-foreground text-sm'>{t('expected')}</div>
            <div className='text-xl font-bold tabular-nums'>
              {formatEgp(shift.expectedCash ?? shift.expectedInDrawer)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm'>{t('counted')}</div>
            <div className='text-xl font-bold tabular-nums'>
              {formatEgp(shift.closingCount)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm'>
              {t('overShort')}
            </div>
            <div
              className={cn(
                'text-xl font-bold tabular-nums',
                overShort >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive'
              )}
            >
              {overShort === 0
                ? t('drawerBalanced')
                : `${t(overShort > 0 ? 'drawerOver' : 'drawerShort')} ${formatEgp(Math.abs(overShort))}`}
            </div>
          </div>
        </div>
      ) : (
        <div className='bg-accent rounded-xl p-4 text-center'>
          <div className='text-muted-foreground text-sm'>
            {t('expectedInDrawer')}
          </div>
          <div className='text-4xl font-bold tabular-nums'>
            {formatEgp(shift.expectedInDrawer)}
          </div>
        </div>
      )}

      <div className='text-sm'>
        <div className='flex items-center justify-between gap-4 py-1'>
          <span className='text-muted-foreground'>{t('openedAt')}</span>
          <span className='text-end'>
            <span className='tabular-nums'>{formatAt(shift.openedAt)}</span>
            {shift.openedBy && (
              <span className='text-muted-foreground'> · {shift.openedBy}</span>
            )}
          </span>
        </div>
        {closed && (
          <div className='flex items-center justify-between gap-4 py-1'>
            <span className='text-muted-foreground'>{t('closedAt')}</span>
            <span className='text-end'>
              <span className='tabular-nums'>{formatAt(shift.closedAt)}</span>
              {shift.closedBy && (
                <span className='text-muted-foreground'>
                  {' '}
                  · {shift.closedBy}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <StatTile
          label={t('openingFloat')}
          value={formatEgp(shift.openingFloat)}
        />
        <StatTile
          label={t('posTicketsSettled')}
          value={String(toNumber(shift.ticketsSettled))}
        />
        <StatTile label={t('salesTotal')} value={formatEgp(shift.salesTotal)} />
        <StatTile
          label={t('changeGiven')}
          value={formatEgp(shift.changeGiven)}
        />
        <StatTile
          label={t('refundsTotal')}
          value={formatEgp(shift.refundsTotal)}
        />
        <StatTile
          label={t('cashRefunds')}
          value={formatEgp(shift.cashRefunds)}
        />
        <StatTile
          label={t('payInsTotal')}
          value={formatEgp(shift.payInsTotal)}
        />
        <StatTile
          label={t('payOutsTotal')}
          value={formatEgp(shift.payOutsTotal)}
        />
      </div>

      {tenders.length > 0 && (
        <div>
          <h4 className='mb-1 text-sm font-semibold'>{t('tenderSplit')}</h4>
          <div className='divide-y rounded-xl border'>
            {tenders.map((total) => {
              const key = tenderLabelKey(total.tender)
              return (
                <div
                  key={total.tender}
                  className='flex items-center justify-between gap-4 px-3 py-2 text-sm'
                >
                  <span>
                    {key ? t(key) : total.tender}
                    <span className='text-muted-foreground tabular-nums'>
                      {' '}
                      × {toNumber(total.count)}
                    </span>
                  </span>
                  <span className='font-semibold tabular-nums'>
                    {formatEgp(total.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className='mb-1 text-sm font-semibold'>{t('drawerMovements')}</h4>
        {movements.length === 0 ? (
          <p className='text-muted-foreground py-2 text-sm'>
            {t('noMovements')}
          </p>
        ) : (
          <div className='divide-y rounded-xl border'>
            {movements.map((movement, index) => {
              const isOut = movement.type === 'PayOut'
              return (
                <div
                  key={index}
                  className='flex items-center justify-between gap-4 px-3 py-2 text-sm'
                >
                  <div className='min-w-0'>
                    <div className='truncate'>{movement.reason}</div>
                    <div className='text-muted-foreground truncate text-xs'>
                      {t(isOut ? 'payOut' : 'payIn')} · {movement.recordedBy}
                      {movement.recordedAt && (
                        <span className='tabular-nums'>
                          {' '}
                          · {dateTime.format(new Date(movement.recordedAt))}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      isOut
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {isOut ? '−' : '+'}
                    {formatEgp(movement.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
