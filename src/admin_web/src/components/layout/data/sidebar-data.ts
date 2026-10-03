import {
  Banknote,
  BarChart3,
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Coffee,
  Radio,
  Contact,
  CreditCard,
  Bike,
  Armchair,
  History,
  LayoutDashboard,
  Megaphone,
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
// a second click to reach a page you need is one too many).
export const sidebarData: SidebarData = {
  navGroups: [
    {
      // The day-to-day screens staff keep open
      title: 'navOperations',
      items: [
        { title: 'dashboard', url: '/', icon: LayoutDashboard },
        // Everything that needs someone now: orders to confirm and tables calling, as two tabs
        { title: 'liveNav', url: '/orders/live', icon: Radio },
        { title: 'orders', url: '/orders', icon: ClipboardList },
        // Rooms & Tables is every business's: the tables and their QR codes live there whatever the plan (a cloud kitchen has none)
        {
          title: 'placesNav',
          url: '/places',
          icon: Armchair,
          needsPlaces: true,
        },
        { title: 'navTill', url: '/till', icon: ReceiptText },
      ],
    },
    {
      title: 'navCatalog',
      // The dishes, and the offers and codes on them, as tabs of one page
      items: [{ title: 'menuItems', url: '/menu', icon: Coffee }],
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
        // Who the business owes and who shares its profit: suppliers and partners as tabs of one page
        {
          title: 'accountsNav',
          url: '/finance/suppliers',
          icon: Truck,
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
