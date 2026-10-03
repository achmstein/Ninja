import { useQuery } from '@tanstack/react-query'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useIsCloudKitchen } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'
import { serviceRequestsService } from '@/features/requests/service'

/**
 * Live: everything that needs someone right now, on one screen of two tabs:
 * the orders waiting to be confirmed, and the tables calling for a waiter or
 * the bill, each with how many there are. A cloud kitchen has no tables to
 * call, so no second tab.
 */
export function LiveTabs({ value }: { value: 'orders' | 'calls' }) {
  const t = useT()
  const cloudKitchen = useIsCloudKitchen()
  const { data: pending = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })
  const { data: calls = [] } = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => serviceRequestsService.pending(),
    refetchInterval: 30_000,
    enabled: !cloudKitchen,
  })
  if (cloudKitchen) return null
  return (
    <PageTabs
      value={value}
      tabs={[
        {
          value: 'orders',
          label: t('liveOrders'),
          to: '/orders/live',
          badge: pending.length,
        },
        {
          value: 'calls',
          label: t('waiterCalls'),
          to: '/requests',
          badge: calls.length,
        },
      ]}
    />
  )
}
