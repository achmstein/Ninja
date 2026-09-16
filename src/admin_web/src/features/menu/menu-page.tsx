import { useT } from '@/lib/i18n'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { PageTabs } from '@/components/page-tabs'

type MenuTab = 'menu' | 'bundles'

type MenuPageProps = {
  tab: MenuTab
  actions?: React.ReactNode
  /** Fixed-height layout with its own scroll region (the bundles grid) */
  fixed?: boolean
  children: React.ReactNode
}

/**
 * The catalogue as one page: the menu itself on the first tab, bundle
 * deals on the second. Categories are headings inside the menu, not a page.
 */
export function MenuPage({ tab, actions, fixed, children }: MenuPageProps) {
  const t = useT()
  return (
    <Main fixed={fixed}>
      <PageHeader title={t('menu')} actions={actions}>
        <PageTabs
          value={tab}
          tabs={[
            { value: 'menu', label: t('items'), to: '/menu' },
            { value: 'bundles', label: t('bundleDeals'), to: '/menu/bundles' },
          ]}
        />
      </PageHeader>
      {children}
    </Main>
  )
}
