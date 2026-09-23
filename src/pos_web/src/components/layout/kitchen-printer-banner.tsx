import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { getKitchenPrintJobsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'

// How long a ticket may wait for its printer before the till says so
const PATIENCE_MS = 60_000

/**
 * A strip under the header while kitchen tickets wait past a minute for
 * their printer: which stations, and what the printer said. A browser
 * cannot reach the shop's printers, so this till only warns; the printing
 * is done by the till app or a kitchen tablet with printing switched on.
 * Polled, since nothing pushes "still not printed".
 */
export function KitchenPrinterBanner() {
  const t = useT()
  const localized = useLocalized()
  const features = useFeatures()

  const { data: waiting = [], dataUpdatedAt } = useQuery({
    ...getKitchenPrintJobsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: features.kds,
    refetchInterval: 20_000,
  })

  const stuck = useMemo(
    () =>
      waiting.filter(
        (ticket) => dataUpdatedAt - new Date(ticket.createdAt ?? 0).getTime() > PATIENCE_MS
      ),
    [waiting, dataUpdatedAt]
  )

  if (!features.kds || stuck.length === 0) return null

  const stations = [...new Set(stuck.map((ticket) => localized(ticket.stationName)))].join('، ')
  const reason = stuck.find((ticket) => ticket.lastError)?.lastError

  return (
    <div className='flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2'>
      <Printer className='size-5 shrink-0 text-amber-600 dark:text-amber-400' />
      <div className='min-w-0'>
        <p className='text-sm font-semibold text-amber-700 dark:text-amber-400'>
          {t('kitchenPrinterStuck', { stations })}
        </p>
        <p className='text-muted-foreground truncate text-xs'>
          {reason ?? t('kitchenPrintingElsewhere')}
        </p>
      </div>
    </div>
  )
}
