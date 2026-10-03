import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/** The menu is its dishes and the offers on them: one page of two tabs */
export function MenuTabs({ value }: { value: 'dishes' | 'offers' }) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        { value: 'dishes', label: t('dishesTab'), to: '/menu' },
        { value: 'offers', label: t('offersTab'), to: '/promos' },
      ]}
    />
  )
}
