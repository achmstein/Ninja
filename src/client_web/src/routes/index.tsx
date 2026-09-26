import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { type CatalogItemDto } from '@/api/catalog'
import { useBrandLayout } from '@/lib/brand-layout'
import { CustomizeDialog } from '@/components/menu/customize-dialog'
import { ListHome } from '@/components/menu/home/list-home'
import { CounterHome } from '@/components/counter/counter-home'
import { PaperHome } from '@/components/menu/home/paper-home'
import { PosterHome } from '@/components/menu/home/poster-home'
import { ShowcaseHome } from '@/components/menu/home/showcase-home'
import { TilesHome } from '@/components/menu/home/tiles-home'
import { useMenuData } from '@/components/menu/home/use-menu'
import { ViewCartBar } from '@/components/menu/view-cart-bar'

export const Route = createFileRoute('/')({
  component: MenuPage,
})

/** The compositions of the menu page, by the style's home part (lib/styles.ts). */
const HOMES = {
  list: ListHome,
  rows: ShowcaseHome,
  paper: PaperHome,
  tiles: TilesHome,
  poster: PosterHome,
  counter: CounterHome,
} as const

function MenuPage() {
  const [search, setSearch] = useState('')
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(
    null
  )
  const menu = useMenuData({ search, setSearch, onCustomize: setCustomizeItem })
  // How the café's style composes the page; the flow after it is the same for all
  const Home = HOMES[useBrandLayout().home] ?? ListHome

  return (
    <Home menu={menu}>
      <ViewCartBar />

      <CustomizeDialog
        item={customizeItem}
        onOpenChange={(open) => {
          if (!open) setCustomizeItem(null)
        }}
        // Adding from a search result means the search did its job
        onAdded={() => setSearch('')}
      />
    </Home>
  )
}
