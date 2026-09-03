import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBranchStore } from '@/stores/branch-store'
import { businessDayWindow } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEgp } from '@/features/orders/status'
import { TENDERS, TICKET_TYPES } from '@/features/till/components/tender'

/**
 * Settled POS sales for the current business day of the active branch:
 * tickets settled, net, discounts, the tender split, and per-type counts.
 * The window is computed client-side from the branch's DayStartTime /
 * DayEndTime and sent to Sales.API as UTC bounds.
 */
export function PosSalesCard() {
  const t = useT()
  const locale = useLocale()
  const branchId = useBranchStore((s) => s.branchId)

  // Same query the sidebar branch switcher runs — served from the cache
  const { data: branches = [] } = useQuery(getBranchesOptions())
  const branch = branches.find((b) => Number(b.id) === branchId)

  // Re-evaluate the window every minute so the card rolls over to the next
  // business day on its own. The ISO bounds (and with them the query key)
  // only actually change at rollover.
  const [minuteTick, setMinuteTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((v) => v + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const dayWindow = useMemo(
    () =>
      branch
        ? businessDayWindow(branch.dayStartTime, branch.dayEndTime, new Date())
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch, minuteTick]
  )

  const report = useQuery({
    ...getRangeReportOptions({
      query: {
        'api-version': API_VERSION,
        from: dayWindow?.from.toISOString() ?? '',
        to: dayWindow?.to.toISOString() ?? '',
      },
    }),
    enabled: dayWindow !== null,
    refetchInterval: 60_000,
  })

  // An empty day (or a 404 from a branch with no tickets yet) shows zeros
  const ticketsSettled = Number(report.data?.ticketsSettled ?? 0)
  const net = Number(report.data?.net ?? 0)
  const discounts = Number(report.data?.discounts ?? 0)
  const changeGiven = Number(report.data?.changeGiven ?? 0)
  const tenderTotals = new Map(
    (report.data?.tenderTotals ?? []).map((row) => [
      row.tender,
      { amount: Number(row.amount ?? 0), count: Number(row.count ?? 0) },
    ])
  )
  const typeTotals = new Map(
    (report.data?.byType ?? []).map((row) => [
      row.type,
      { count: Number(row.count ?? 0), net: Number(row.net ?? 0) },
    ])
  )

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle>{t('posSalesTitle')}</CardTitle>
          <CardDescription>
            {dayWindow
              ? `${t('posSalesDescription')} · ${formatTime(dayWindow.from)} – ${formatTime(dayWindow.to)}`
              : t('posSalesDescription')}
          </CardDescription>
        </div>
        <ReceiptText className='text-muted-foreground h-4 w-4 shrink-0' />
      </CardHeader>
      <CardContent>
        {!dayWindow || report.isPending ? (
          <div className='space-y-4'>
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-40 w-full' />
          </div>
        ) : (
          <div className='space-y-5'>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <div className='text-2xl font-bold tabular-nums'>
                  {ticketsSettled}
                </div>
                <p className='text-muted-foreground text-xs'>
                  {t('posTicketsSettled')}
                </p>
              </div>
              <div>
                <div className='text-2xl font-bold tabular-nums'>
                  {formatEgp(net)}
                </div>
                <p className='text-muted-foreground text-xs'>{t('netSales')}</p>
              </div>
              <div>
                <div className='text-2xl font-bold tabular-nums'>
                  {formatEgp(discounts)}
                </div>
                <p className='text-muted-foreground text-xs'>
                  {t('discountsTotal')}
                </p>
              </div>
            </div>

            <div>
              <h4 className='mb-2 text-sm font-medium'>{t('tenderSplit')}</h4>
              <div className='space-y-1.5'>
                {TENDERS.map(({ name, labelKey }) => {
                  const row = tenderTotals.get(name)
                  return (
                    <div
                      key={name}
                      className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'
                    >
                      <span>{t(labelKey)}</span>
                      <span className='flex items-baseline gap-2'>
                        <span className='text-muted-foreground text-xs'>
                          {t('posTicketsCount', { count: row?.count ?? 0 })}
                        </span>
                        <span className='font-medium tabular-nums'>
                          {formatEgp(row?.amount ?? 0)}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
              {changeGiven > 0 && (
                <p className='text-muted-foreground mt-2 text-xs'>
                  {t('changeGivenNote', { amount: formatEgp(changeGiven) })}
                </p>
              )}
            </div>

            <div>
              <h4 className='mb-2 text-sm font-medium'>{t('byTicketType')}</h4>
              <div className='grid grid-cols-3 gap-2'>
                {TICKET_TYPES.map(({ name, labelKey }) => {
                  const row = typeTotals.get(name)
                  return (
                    <div
                      key={name}
                      className='rounded-lg border px-3 py-2 text-center'
                    >
                      <div className='text-lg font-bold tabular-nums'>
                        {row?.count ?? 0}
                      </div>
                      <p className='text-muted-foreground text-xs'>
                        {t(labelKey)}
                      </p>
                      <p className='text-muted-foreground text-xs tabular-nums'>
                        {formatEgp(row?.net ?? 0)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
