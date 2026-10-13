import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/**
 * Stock as one page of five tabs: what the branch has, the ledger behind
 * it, the reports on it, what the menu costs to make from it, and how each
 * item pays against what it sells.
 */
export function StockTabs({
  value,
}: {
  value: 'stock' | 'history' | 'reports' | 'menu-cost' | 'menu-engineering'
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
        {
          value: 'menu-engineering',
          label: t('menuEngineering'),
          to: '/inventory/menu-engineering',
        },
      ]}
    />
  )
}
