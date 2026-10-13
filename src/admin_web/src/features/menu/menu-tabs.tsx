import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/** The menu is its items, the offers on them and what the app promotes: one page of three tabs */
export function MenuTabs({
  value,
}: {
  value: 'items' | 'offers' | 'promotions'
}) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        { value: 'items', label: t('itemsTab'), to: '/menu' },
        { value: 'offers', label: t('offersTab'), to: '/promos' },
        { value: 'promotions', label: t('promotionsTab'), to: '/promotions' },
      ]}
    />
  )
}
