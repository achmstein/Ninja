import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/** Live queue | History — the two faces of Orders, both real URLs. */
export function OrdersTabs({
  value,
  pendingCount,
}: {
  value: 'live' | 'history'
  pendingCount?: number
}) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        { value: 'live', label: t('live'), to: '/orders', badge: pendingCount },
        { value: 'history', label: t('history'), to: '/orders/history' },
      ]}
    />
  )
}
