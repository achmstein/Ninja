import { useT } from '@/lib/i18n'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { PageTabs } from '@/components/page-tabs'

export type HistoryTab = 'movements' | 'purchases' | 'counts' | 'transfers'

type HistoryPageProps = {
  tab: HistoryTab
  children: React.ReactNode
}

/**
 * The inventory ledger as one page with a tab per kind of record. Every
 * posting is made from Stock; here you only look things up.
 */
export function HistoryPage({ tab, children }: HistoryPageProps) {
  const t = useT()
  return (
    <Main className='flex flex-col gap-4'>
      <PageHeader
        title={t('inventoryHistory')}
        description={t('historySubtitle')}
      >
        <PageTabs
          value={tab}
          tabs={[
            {
              value: 'movements',
              label: t('inventoryMovements'),
              to: '/inventory/history',
            },
            {
              value: 'purchases',
              label: t('inventoryPurchases'),
              to: '/inventory/history/purchases',
            },
            {
              value: 'counts',
              label: t('inventoryCounts'),
              to: '/inventory/history/counts',
            },
            {
              value: 'transfers',
              label: t('inventoryTransfers'),
              to: '/inventory/history/transfers',
            },
          ]}
        />
      </PageHeader>
      {children}
    </Main>
  )
}
