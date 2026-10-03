import { describe, expect, it } from 'vitest'
import { sidebarData } from './data/sidebar-data'
import { checkIsActive, navTrail } from './nav-active'
import { type NavItem } from './types'

// The sidebar highlights exactly one entry per group. These pin the rule
// for child pages that have no nav item of their own.

const link = (url: string): NavItem =>
  ({ title: 'menu', url }) as unknown as NavItem

/** The Menu & stock group, as sidebar data has it */
const menuStock = ['/menu', '/inventory']

/** Stock, whose History, Reports and Menu cost are tabs of its page */
const stock = {
  title: 'inventoryStock',
  url: '/inventory',
  tabs: [
    { title: 'inventoryHistory', url: '/inventory/history' },
    { title: 'inventoryReports', url: '/inventory/reports' },
    { title: 'menuCost', url: '/inventory/menu-cost' },
  ],
} as unknown as NavItem

/** Employees, with its tabs and the employee's own page */
const employees = {
  title: 'navPayrollEmployees',
  url: '/payroll/employees',
  tabs: [
    { title: 'navPayrollAttendance', url: '/payroll/attendance' },
    { title: 'navPayrollPayslips', url: '/payroll/payslips' },
  ],
  match: ['/payroll/employee'],
} as unknown as NavItem

describe('checkIsActive', () => {
  it('lights the entry whose url the page is', () => {
    expect(checkIsActive('/inventory', stock, false, menuStock)).toBe(true)
  })

  it('keeps a query string out of the comparison', () => {
    expect(checkIsActive('/inventory?page=2', stock, false, menuStock)).toBe(
      true
    )
  })

  it('lights the entry for each of its tabs', () => {
    for (const path of [
      '/inventory/history',
      '/inventory/history/counts',
      '/inventory/reports',
      '/inventory/menu-cost',
    ]) {
      expect(checkIsActive(path, stock, false, menuStock)).toBe(true)
    }
    expect(checkIsActive('/menu', stock, false, menuStock)).toBe(false)
  })

  it('lights Employees for its tabs and an employee page, not Staff', () => {
    const team = ['/payroll/employees', '/staff']
    for (const path of [
      '/payroll/attendance',
      '/payroll/payslips',
      '/payroll/employee/5',
    ]) {
      expect(checkIsActive(path, employees, false, team)).toBe(true)
      expect(checkIsActive(path, link('/staff'), false, team)).toBe(false)
    }
  })

  it('lets a more specific sibling win: Live, not Orders', () => {
    const today = ['/', '/orders/live', '/orders']
    expect(checkIsActive('/orders/live', link('/orders'), false, today)).toBe(
      false
    )
    expect(
      checkIsActive('/orders/live', link('/orders/live'), false, today)
    ).toBe(true)
  })

  it('lights Menu for a menu item page', () => {
    const menu = ['/menu', '/menu/categories']
    expect(checkIsActive('/menu/42/stock', link('/menu'), false, menu)).toBe(
      true
    )
    expect(checkIsActive('/menu/categories', link('/menu'), false, menu)).toBe(
      false
    )
  })

  it('never lights the root for a child page', () => {
    expect(checkIsActive('/inventory/history', link('/'), false, ['/'])).toBe(
      false
    )
  })
})

describe('navTrail', () => {
  it('names a tab by its entry and group', () => {
    const groups = [
      { title: 'navMenuStock', items: [link('/menu'), stock] },
    ] as Parameters<typeof navTrail>[1]
    expect(navTrail('/inventory/history/counts', groups)).toEqual({
      group: 'navMenuStock',
      page: 'inventoryStock',
    })
  })
})

describe('every page tab keeps its sidebar entry lit', () => {
  // The tab rows' destinations (Live | Calls, Dishes | Offers, the till's,
  // Stock's, Employees', Accounts'): each must light one sidebar entry
  const tabUrls = [
    '/orders/live',
    '/requests',
    '/menu',
    '/promos',
    '/till/tickets',
    '/till/shifts',
    '/till/breakdown',
    '/places/history',
    '/places/reservations',
    '/inventory/history/counts',
    '/inventory/reports',
    '/inventory/menu-cost',
    '/payroll/attendance',
    '/payroll/payslips',
    '/finance/partners',
  ]
  for (const url of tabUrls) {
    it(url, () => {
      const lit = sidebarData.navGroups.flatMap((group) => {
        const urls = group.items.map((item) => String(item.url))
        return group.items.filter((item) =>
          checkIsActive(url, item, false, urls)
        )
      })
      expect(lit).toHaveLength(1)
    })
  }
})
