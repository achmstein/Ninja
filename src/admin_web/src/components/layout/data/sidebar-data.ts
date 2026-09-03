import {
  LayoutDashboard,
  Armchair,
  Banknote,
  Coffee,
  ClipboardList,
  Clock,
  ConciergeBell,
  Gamepad2,
  Building2,
  Megaphone,
  Package,
  ReceiptText,
  ShieldCheck,
  Tag,
  Ticket,
  Undo2,
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
      // The till's books, read-only: what was sold, paid, refunded, counted
      title: 'navTill',
      items: [
        {
          title: 'tillSales',
          url: '/till',
          icon: ReceiptText,
        },
        {
          title: 'tillTickets',
          url: '/till/tickets',
          icon: Ticket,
        },
        {
          title: 'tillPayments',
          url: '/till/payments',
          icon: Banknote,
        },
        {
          title: 'tillRefunds',
          url: '/till/refunds',
          icon: Undo2,
        },
        {
          title: 'tillShifts',
          url: '/till/shifts',
          icon: Clock,
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
