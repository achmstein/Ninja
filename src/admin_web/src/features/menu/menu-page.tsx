import { useT } from '@/lib/i18n'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'

type MenuPageProps = {
  actions?: React.ReactNode
  /** Fixed-height layout with its own scroll region */
  fixed?: boolean
  children: React.ReactNode
}

/**
 * The catalogue as one page. Categories are headings inside the menu, not
 * a page; a combo is an item with a recipe, not a second kind of thing.
 */
export function MenuPage({ actions, fixed, children }: MenuPageProps) {
  const t = useT()
  return (
    <Main fixed={fixed}>
      <PageHeader title={t('menu')} actions={actions} />
      {children}
    </Main>
  )
}
