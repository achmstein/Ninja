import { type ShiftView } from '@/api/sales'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Stat, StatStrip } from '@/components/stat-strip'
import { tenderLabelKey } from './tender'
import { TenderBadge } from './tender-badge'

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
          ? 'bg-success/15 text-success'
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
  const tabTenders = shift.tabPaymentTenderTotals ?? []
  const tabPayments = shift.tabPayments ?? []
  const movements = shift.movements ?? []

  return (
    <div className='flex flex-col gap-5'>
      {closed ? (
        <div className='grid grid-cols-3 gap-4'>
          <Stat
            size='hero'
            label={t('expected')}
            value={formatEgp(shift.expectedCash ?? shift.expectedInDrawer)}
            className='[&>div:nth-child(2)]:text-2xl'
          />
          <Stat
            size='hero'
            label={t('counted')}
            value={formatEgp(shift.closingCount)}
            className='[&>div:nth-child(2)]:text-2xl'
          />
          <Stat
            size='hero'
            label={t('overShort')}
            value={
              overShort === 0
                ? t('drawerBalanced')
                : `${overShort > 0 ? '+' : '−'}${formatEgp(Math.abs(overShort))}`
            }
            tone={overShort >= 0 ? 'positive' : 'negative'}
            className='[&>div:nth-child(2)]:text-2xl'
          />
        </div>
      ) : (
        <Stat
          size='hero'
          label={t('expectedInDrawer')}
          value={formatEgp(shift.expectedInDrawer)}
        />
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

      <StatStrip>
        <Stat label={t('openingFloat')} value={formatEgp(shift.openingFloat)} />
        <Stat
          label={t('posTicketsSettled')}
          value={String(toNumber(shift.ticketsSettled))}
        />
        <Stat label={t('salesTotal')} value={formatEgp(shift.salesTotal)} />
        <Stat label={t('changeGiven')} value={formatEgp(shift.changeGiven)} />
        <Stat
          label={t('refundsTotal')}
          value={formatEgp(shift.refundsTotal)}
          hint={`${t('cashRefunds')} ${formatEgp(shift.cashRefunds)}`}
        />
        <Stat
          label={t('tabPayments')}
          value={formatEgp(shift.tabPaymentsTotal)}
          hint={`${t('cashTabPayments')} ${formatEgp(shift.cashTabPayments)}`}
        />
        <Stat
          label={t('payInsTotal')}
          value={formatEgp(shift.payInsTotal)}
          tone='positive'
        />
        <Stat
          label={t('payOutsTotal')}
          value={formatEgp(shift.payOutsTotal)}
          tone='negative'
        />
      </StatStrip>

      {tenders.length > 0 && (
        <section>
          <h4 className='mb-1 text-sm font-medium'>{t('tenderSplit')}</h4>
          <ul className='divide-y text-sm'>
            {tenders.map((total) => {
              const key = tenderLabelKey(total.tender)
              return (
                <li
                  key={total.tender}
                  className='flex items-center justify-between gap-4 py-2'
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
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Account tabs paid at the counter: part of the drawer, not of sales */}
      {(tabTenders.length > 0 || tabPayments.length > 0) && (
        <section>
          <h4 className='mb-1 text-sm font-medium'>{t('tabPayments')}</h4>
          {tabTenders.length > 0 && (
            <ul className='divide-y text-sm'>
              {tabTenders.map((total) => {
                const key = tenderLabelKey(total.tender)
                return (
                  <li
                    key={total.tender}
                    className='flex items-center justify-between gap-4 py-2'
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
                  </li>
                )
              })}
            </ul>
          )}
          {tabPayments.length > 0 && (
            <>
              <Separator className='my-2' />
              <ul className='divide-y text-sm'>
                {tabPayments.map((payment) => (
                  <li
                    key={String(payment.id)}
                    className='flex items-center justify-between gap-3 py-2'
                  >
                    <div className='flex min-w-0 items-center gap-2'>
                      <TenderBadge tender={payment.tender} />
                      <span className='text-muted-foreground truncate text-xs'>
                        {[payment.customerName, payment.recordedBy]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <span className='font-medium tabular-nums'>
                      {formatEgp(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section>
        <h4 className='mb-1 text-sm font-medium'>{t('drawerMovements')}</h4>
        {movements.length === 0 ? (
          <p className='text-muted-foreground py-2 text-sm'>
            {t('noMovements')}
          </p>
        ) : (
          <ul className='divide-y text-sm'>
            {movements.map((movement, index) => {
              const isOut = movement.type === 'PayOut'
              return (
                <li
                  key={index}
                  className='flex items-center justify-between gap-4 py-2'
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
                      isOut ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {isOut ? '−' : '+'}
                    {formatEgp(movement.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
