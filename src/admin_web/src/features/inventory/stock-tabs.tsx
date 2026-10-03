import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/**
 * Stock as one page of four tabs: what the branch has, the ledger behind
 * it, the reports on it, and what the menu costs to make from it.
 */
export function StockTabs({
  value,
}: {
  value: 'stock' | 'history' | 'reports' | 'menu-cost'
}) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        { value: 'stock', label: t('inventoryStock'), to: '/inventory' },
        {
          value: 'history',
          label: t('inventoryHistory'),
          to: '/inventory/history',
        },
        {
          value: 'reports',
          label: t('inventoryReports'),
          to: '/inventory/reports',
        },
        {
          value: 'menu-cost',
          label: t('menuCost'),
          to: '/inventory/menu-cost',
        },
      ]}
    />
  )
}
