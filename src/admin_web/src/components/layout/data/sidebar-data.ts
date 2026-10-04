import {
  Building2,
  Coffee,
  Radio,
  Contact,
  CreditCard,
  Bike,
  Armchair,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Motorbike,
  Palette,
  Receipt,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { type SidebarData } from '../types'

// Titles are translation keys, rendered through t() in NavGroup.
// Every page is one click away: flat items, no nested menus (owner's call —
// a second click to reach a page you need is one too many). A job is one
// entry; its views are tabs of that page (Live, Till, Menu, Stock, Employees).
export const sidebarData: SidebarData = {
  navGroups: [
    {
      // The screens kept open through the day
      title: 'navToday',
      items: [
        { title: 'dashboard', url: '/', icon: LayoutDashboard },
        // Everything that needs someone now: orders to confirm and tables calling, as two tabs
        {
          title: 'liveNav',
          url: '/orders/live',
          icon: Radio,
          tabs: [{ title: 'waiterCalls', url: '/requests' }],
        },
        { title: 'orders', url: '/orders', icon: ClipboardList },
        // Rooms & Tables is every business's: the tables and their QR codes live there whatever the plan (a cloud kitchen has none)
        {
          title: 'placesNav',
          url: '/places',
          icon: Armchair,
          needsPlaces: true,
        },
      ],
    },
    {
      title: 'navMenuStock',
      items: [
        // The dishes, and the offers and codes on them, as tabs of one page
        {
          title: 'menuItems',
          url: '/menu',
          icon: Coffee,
          tabs: [{ title: 'offersTab', url: '/promos' }],
        },
        // What the branch has, the ledger behind it, what the menu takes out
        // of it. Every posting is made from Stock.
        {
          title: 'inventoryStock',
          url: '/inventory',
          icon: Warehouse,
          feature: 'inventory',
          tabs: [
            { title: 'inventoryHistory', url: '/inventory/history' },
            { title: 'inventoryReports', url: '/inventory/reports' },
            { title: 'menuCost', url: '/inventory/menu-cost' },
          ],
        },
      ],
    },
    {
      // What came in (the till) and what went out (bills, suppliers), and what is left
      title: 'navMoney',
      items: [
        { title: 'navTill', url: '/till', icon: ReceiptText },
        {
          title: 'navFinanceExpenses',
          url: '/finance/expenses',
          icon: Receipt,
          feature: 'finance',
        },
        // Who the business owes and who shares its profit: suppliers and partners as tabs of one page
        {
          title: 'accountsNav',
          url: '/finance/suppliers',
          icon: Truck,
          feature: 'finance',
          tabs: [
            {
              title: 'navFinancePartners',
              url: '/finance/partners',
              ownerOnly: true,
            },
          ],
        },
        {
          title: 'navFinanceProfit',
          url: '/finance/profit',
          icon: TrendingUp,
          feature: 'finance',
          ownerOnly: true,
        },
      ],
    },
    {
      // The people: the register with its attendance and payslips, and who signs in
      title: 'navTeam',
      items: [
        {
          title: 'navPayrollEmployees',
          url: '/payroll/employees',
          icon: Contact,
          feature: 'payroll',
          tabs: [
            { title: 'navPayrollAttendance', url: '/payroll/attendance' },
            { title: 'navPayrollPayslips', url: '/payroll/payslips' },
          ],
          // An employee's own page
          match: ['/payroll/employee'],
        },
        // Who is riding now, and each rider's deliveries: only where the business delivers
        {
          title: 'ridersNav',
          url: '/riders',
          icon: Motorbike,
          feature: 'delivery',
        },
        {
          title: 'staffAccounts',
          url: '/staff',
          icon: ShieldCheck,
          ownerOnly: true,
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
      // The business itself: where it is and how it looks
      title: 'navBusiness',
      ownerOnly: true,
      items: [
        { title: 'branches', url: '/branches', icon: Building2 },
        { title: 'brandNav', url: '/brand', icon: Palette },
      ],
    },
    {
      // What the business is plugged into outside the admin
      title: 'navConnections',
      ownerOnly: true,
      items: [
        // Online payments: the business's own payment account, fee and splits
        {
          title: 'onlinePaymentsNav',
          url: '/payments',
          icon: CreditCard,
          entitled: 'onlinePayments',
        },
        // Talabat: which branches sell there, and the menu it shows
        { title: 'talabatNav', url: '/talabat', icon: Bike },
        // The native till and kitchen display: where to get them, how a tablet connects
        { title: 'appsNav', url: '/apps', icon: TabletSmartphone },
        // The owner's assistant: this business's MCP server in their own Claude or ChatGPT, in every plan
        { title: 'assistantNav', url: '/assistant', icon: Sparkles },
      ],
    },
  ],
}
