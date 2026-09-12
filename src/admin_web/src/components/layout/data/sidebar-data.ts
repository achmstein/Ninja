import {
  LayoutDashboard,
  Armchair,
  Coffee,
  ClipboardList,
  ConciergeBell,
  Gamepad2,
  History,
  BarChart3,
  Building2,
  Megaphone,
  Package,
  ReceiptText,
  ShieldCheck,
  Users,
  Warehouse,
} from 'lucide-react'
import { type SidebarData } from '../types'

// Titles are translation keys, rendered through t() in NavGroup.
// Every page is one click away: flat items, no nested menus (owner's call —
// a second click to reach a page you need is one too many).
export const sidebarData: SidebarData = {
  navGroups: [
    {
      // The day-to-day screens staff keep open
      title: 'navOperations',
      items: [
        { title: 'dashboard', url: '/', icon: LayoutDashboard },
        { title: 'orders', url: '/orders', icon: ClipboardList },
        { title: 'rooms', url: '/rooms', icon: Gamepad2 },
        { title: 'tables', url: '/tables', icon: Armchair },
        { title: 'requests', url: '/requests', icon: ConciergeBell },
        { title: 'navTill', url: '/till', icon: ReceiptText },
      ],
    },
    {
      title: 'navCatalog',
      items: [
        { title: 'menuItems', url: '/menu', icon: Coffee },
        { title: 'bundleDeals', url: '/menu/bundles', icon: Package },
      ],
    },
    {
      // Stock: what the branch has, what the menu takes out of it, and the
      // ledger behind it. Every posting is made from Stock.
      title: 'navInventory',
      items: [
        { title: 'inventoryStock', url: '/inventory', icon: Warehouse },
        {
          title: 'inventoryHistory',
          url: '/inventory/history',
          icon: History,
        },
        {
          title: 'inventoryReports',
          url: '/inventory/reports',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'navCustomers',
      items: [
        { title: 'customers', url: '/customers', icon: Users },
        { title: 'announcements', url: '/notifications', icon: Megaphone },
      ],
    },
    {
      title: 'navAdministration',
      ownerOnly: true,
      items: [
        { title: 'branches', url: '/branches', icon: Building2 },
        { title: 'staff', url: '/staff', icon: ShieldCheck },
      ],
    },
  ],
}
