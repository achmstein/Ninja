import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/** The menu is its dishes, the offers on them and what the app promotes: one page of three tabs */
export function MenuTabs({
  value,
}: {
  value: 'dishes' | 'offers' | 'promotions'
}) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        { value: 'dishes', label: t('dishesTab'), to: '/menu' },
        { value: 'offers', label: t('offersTab'), to: '/promos' },
        { value: 'promotions', label: t('promotionsTab'), to: '/promotions' },
      ]}
    />
  )
}
