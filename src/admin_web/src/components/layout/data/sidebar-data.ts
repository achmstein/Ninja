import {
  Banknote,
  BarChart3,
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Coffee,
  ConciergeBell,
  Contact,
  Gamepad2,
  Handshake,
  History,
  LayoutDashboard,
  Megaphone,
  Palette,
  Receipt,
  ReceiptText,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Truck,
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
        { title: 'placesNav', url: '/places', icon: Gamepad2, feature: 'spaces' },
        { title: 'requests', url: '/requests', icon: ConciergeBell, feature: 'spaces' },
        { title: 'navTill', url: '/till', icon: ReceiptText },
      ],
    },
    {
      title: 'navCatalog',
      items: [
        { title: 'menuItems', url: '/menu', icon: Coffee },
      ],
    },
    {
      // Stock: what the branch has, what the menu takes out of it, and the
      // ledger behind it. Every posting is made from Stock.
      title: 'navInventory',
      feature: 'inventory',
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
        {
          title: 'menuCost',
          url: '/inventory/menu-cost',
          icon: ChefHat,
        },
      ],
    },
    {
      // People: the register, the month's attendance, the month's payslips
      title: 'navPayroll',
      feature: 'payroll',
      items: [
        {
          title: 'navPayrollEmployees',
          url: '/payroll/employees',
          icon: Contact,
        },
        {
          title: 'navPayrollAttendance',
          url: '/payroll/attendance',
          icon: CalendarCheck,
        },
        {
          title: 'navPayrollPayslips',
          url: '/payroll/payslips',
          icon: Banknote,
        },
      ],
    },
    {
      // Money beyond stock and staff: bills, supplier tabs, the owners' own
      title: 'navFinance',
      feature: 'finance',
      items: [
        {
          title: 'navFinanceExpenses',
          url: '/finance/expenses',
          icon: Receipt,
        },
        {
          title: 'navFinanceSuppliers',
          url: '/finance/suppliers',
          icon: Truck,
        },
        // The owners' own: who they are, what they hold, whether the
        // month made money
        {
          title: 'navFinancePartners',
          url: '/finance/partners',
          icon: Handshake,
          ownerOnly: true,
        },
        {
          title: 'navFinanceProfit',
          url: '/finance/profit',
          icon: TrendingUp,
          ownerOnly: true,
        },
      ],
    },
    {
      title: 'navCustomers',
      items: [
        { title: 'customers', url: '/customers', icon: Users },
        { title: 'promoCodes', url: '/promos', icon: Ticket },
        { title: 'announcements', url: '/notifications', icon: Megaphone },
      ],
    },
    {
      title: 'navAdministration',
      ownerOnly: true,
      items: [
        { title: 'branches', url: '/branches', icon: Building2 },
        { title: 'staffAccounts', url: '/staff', icon: ShieldCheck },
        { title: 'brandNav', url: '/brand', icon: Palette },
      ],
    },
  ],
}
