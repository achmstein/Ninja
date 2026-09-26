import { createFileRoute } from '@tanstack/react-router'
import { NinjaHome } from '@/components/ninja/ninja-home'
import { useMenuData } from '@/components/menu/home/use-menu'

export const Route = createFileRoute('/')({
  component: MenuPage,
})

function MenuPage() {
  return <NinjaHome menu={useMenuData()} />
}
