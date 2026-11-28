import { createFileRoute } from '@tanstack/react-router'
import { useMenuData } from '@/components/menu/data/use-menu'
import { MenuScreen } from '@/components/menu/menu-screen'

export const Route = createFileRoute('/')({
  component: MenuPage,
})

function MenuPage() {
  return <MenuScreen menu={useMenuData()} />
}
