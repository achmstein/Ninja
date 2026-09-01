import {
  LayoutDashboard,
  Armchair,
  Coffee,
  ClipboardList,
  ConciergeBell,
  Gamepad2,
  Building2,
  Megaphone,
  Package,
  ShieldCheck,
  Tag,
  Users,
  Award,
  Wallet,
} from 'lucide-react'
import { type SidebarData } from '../types'

// Titles are translation keys, rendered through t() in NavGroup
export const sidebarData: SidebarData = {
  navGroups: [
    {
      // The day-to-day screens staff keep open
      title: 'navOperations',
      items: [
        {
          title: 'dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'orders',
          url: '/orders',
          icon: ClipboardList,
        },
        {
          title: 'rooms',
          url: '/rooms',
          icon: Gamepad2,
        },
        {
          title: 'tables',
          url: '/tables',
          icon: Armchair,
        },
        {
          title: 'requests',
          url: '/requests',
          icon: ConciergeBell,
        },
      ],
    },
    {
      title: 'navCatalog',
      items: [
        {
          title: 'menuItems',
          url: '/menu',
          icon: Coffee,
        },
        {
          title: 'categories',
          url: '/menu/categories',
          icon: Tag,
        },
        {
          title: 'bundleDeals',
          url: '/menu/bundles',
          icon: Package,
        },
      ],
    },
    {
      title: 'navCustomers',
      items: [
        {
          title: 'customers',
          url: '/customers',
          icon: Users,
        },
        {
          title: 'loyalty',
          url: '/loyalty',
          icon: Award,
        },
        {
          title: 'accounts',
          url: '/accounts',
          icon: Wallet,
        },
        {
          title: 'announcements',
          url: '/notifications',
          icon: Megaphone,
        },
      ],
    },
    {
      title: 'navAdministration',
      ownerOnly: true,
      items: [
        {
          title: 'branches',
          url: '/branches',
          icon: Building2,
        },
        {
          title: 'staff',
          url: '/staff',
          icon: ShieldCheck,
        },
      ],
    },
  ],
}
