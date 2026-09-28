import { createFileRoute } from '@tanstack/react-router'
import { MenuScreen } from '@/components/menu/menu-screen'
import { useMenuData } from '@/components/menu/data/use-menu'

export const Route = createFileRoute('/')({
  component: MenuPage,
})

function MenuPage() {
  return <MenuScreen menu={useMenuData()} />
}
