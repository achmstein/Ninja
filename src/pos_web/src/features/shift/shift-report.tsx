import type { ShiftView } from '@/api/sales/types.gen'
import { Badge } from '@/components/ui/badge'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { drawerFormula } from './drawer'

/**
 * Over/short verdict badge: green when the drawer is over or balanced,
 * red when short. Shared by the report and the Z-history rows.
 */
export function OverShortBadge({ value }: { value: number }) {
  const t = useT()
  const money = useMoney()
  return (
    <Badge
      className={cn(
        'border-transparent text-sm tabular-nums',
        value >= 0
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/15 text-destructive'
      )}
    >
      {value === 0
        ? t('drawerBalanced')
        : `${t(value > 0 ? 'drawerOver' : 'drawerShort')} ${money(Math.abs(value))}`}
    </Badge>
  )
}

/**
 * The shift figures, shared by the live X view (/shift), the Z result
 * shown right after closing, and the Z-history detail. An open shift leads
 * with the live expected-in-drawer amount; a closed one leads with the
 * expected-vs-counted verdict.
 */
export function ShiftReport({ shift }: { shift: ShiftView }) {
  const t = useT()
  const money = useMoney()
  const locale = useLocale()

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''
  // A movement happened inside this shift: its time is enough, the header
  // already says which day
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })

  const closed = shift.status === 'Closed'
  const overShort = toNumber(shift.overShort)
  const tenders = shift.tenderTotals ?? []
  const tabPayments = shift.tabPaymentTenderTotals ?? []
  const movements = shift.movements ?? []
  const drawer = drawerFormula(shift)

  const stat = (label: string, value: string) => (
    <div className='bg-card rounded-xl border p-3'>
      <div className='text-muted-foreground text-sm'>{label}</div>
      <div className='text-lg font-semibold tabular-nums'>{value}</div>
    </div>
  )

  return (
    <div className='flex flex-col gap-4'>
      {/* The headline: what should be in the drawer (X), or how the count
          actually landed (Z) */}
      {closed ? (
        <div className='bg-accent grid grid-cols-3 gap-2 rounded-xl p-4 text-center'>
          <div>
            <div className='text-muted-foreground text-sm'>{t('expected')}</div>
            <div className='text-xl font-bold tabular-nums'>
              {money(shift.expectedCash ?? shift.expectedInDrawer)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm'>{t('counted')}</div>
            <div className='text-xl font-bold tabular-nums'>
              {money(shift.closingCount)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm'>{t('overShort')}</div>
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
                : `${t(overShort > 0 ? 'drawerOver' : 'drawerShort')} ${money(Math.abs(overShort))}`}
            </div>
          </div>
        </div>
      ) : (
        <div className='bg-accent rounded-xl p-4 text-center'>
          <div className='text-muted-foreground text-sm'>
            {t('expectedInDrawer')}
          </div>
          <div className='text-4xl font-bold tabular-nums'>
            {money(shift.expectedInDrawer)}
          </div>
        </div>
      )}

      {/* Opened / closed meta */}
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
                  {' '}· {shift.closedBy}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Sales: gross is what the bills settled in the shift came to;
          net takes off the credit notes issued in it, whatever the tender */}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
        {stat(t('ticketsSettled'), String(toNumber(shift.ticketsSettled)))}
        {stat(t('grossSales'), money(shift.grossSales ?? shift.salesTotal))}
        {stat(t('discount'), money(shift.discounts))}
        {stat(t('refundsIssued'), money(shift.refundsTotal))}
        {stat(t('netSales'), money(shift.netSales ?? shift.salesTotal))}
        {stat(t('changeGiven'), money(shift.changeGiven))}
      </div>

      {/* The drawer, term by term, adding up to Expected */}
      <div>
        <h2 className='mb-1 text-sm font-semibold'>{t('drawerFormula')}</h2>
        <div className='divide-y rounded-xl border'>
          {drawer.terms.map((term) => (
            <div
              key={term.key}
              className='flex items-center justify-between gap-4 px-3 py-2'
            >
              <span>{t(term.key)}</span>
              <span className='tabular-nums'>
                {term.sign < 0 ? '−' : '+'}
                {money(term.amount)}
              </span>
            </div>
          ))}
          <div className='flex items-center justify-between gap-4 px-3 py-2 font-semibold'>
            <span>{t('expectedInDrawer')}</span>
            <span className='tabular-nums'>= {money(drawer.expected)}</span>
          </div>
          {drawer.lateCash !== 0 && (
            <div className='flex items-center justify-between gap-4 px-3 py-2'>
              <span className='text-muted-foreground'>{t('lateCash')}</span>
              <span className='tabular-nums'>{money(drawer.lateCash)}</span>
            </div>
          )}
          {drawer.lateCash !== 0 && drawer.adjustedOverShort != null && (
            <div className='flex items-center justify-between gap-4 px-3 py-2'>
              <span className='text-muted-foreground'>
                {t('adjustedOverShort')}
              </span>
              <OverShortBadge value={drawer.adjustedOverShort} />
            </div>
          )}
        </div>
      </div>

      {/* Tender split: bills only, cash net of the change handed back */}
      {tenders.length > 0 && (
        <div>
          <h2 className='mb-1 text-sm font-semibold'>{t('billsByTender')}</h2>
          <div className='divide-y rounded-xl border'>
            {tenders.map((total) => (
              <div
                key={total.tender}
                className='flex items-center justify-between gap-4 px-3 py-2'
              >
                <span>
                  {tenderLabelKey[total.tender]
                    ? t(tenderLabelKey[total.tender])
                    : total.tender}
                  <span className='text-muted-foreground text-sm tabular-nums'>
                    {' '}× {toNumber(total.count)}
                  </span>
                </span>
                <span className='font-semibold tabular-nums'>
                  {money(total.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Money taken against tabs: beside the sales, never inside them */}
      {tabPayments.length > 0 && (
        <div>
          <h2 className='mb-1 text-sm font-semibold'>{t('tabPayments')}</h2>
          <div className='divide-y rounded-xl border'>
            {tabPayments.map((total) => (
              <div
                key={total.tender}
                className='flex items-center justify-between gap-4 px-3 py-2'
              >
                <span>
                  {tenderLabelKey[total.tender]
                    ? t(tenderLabelKey[total.tender])
                    : total.tender}
                  <span className='text-muted-foreground text-sm tabular-nums'>
                    {' '}× {toNumber(total.count)}
                  </span>
                </span>
                <span className='font-semibold tabular-nums'>
                  {money(total.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pay-ins / pay-outs with their reasons */}
      <div>
        <h2 className='mb-1 text-sm font-semibold'>{t('drawerMovements')}</h2>
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
                  className='flex items-center justify-between gap-4 px-3 py-2'
                >
                  <div className='min-w-0'>
                    <div className='truncate'>{movement.reason}</div>
                    <div className='text-muted-foreground truncate text-sm'>
                      {/* A Latin name next to an Arabic time confuses the bidi
                          algorithm ("م" drifting to the line's end); each
                          piece is isolated */}
                      {t(isOut ? 'payOutNoun' : 'payInNoun')} ·{' '}
                      <bdi>{movement.recordedBy}</bdi>
                      {movement.recordedAt && (
                        <>
                          {' '}·{' '}
                          <bdi className='tabular-nums'>
                            {time.format(new Date(movement.recordedAt))}
                          </bdi>
                        </>
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
                    {money(movement.amount)}
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
