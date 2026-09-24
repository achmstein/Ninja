import { describe, expect, it } from 'vitest'
import { checkIsActive } from './nav-active'
import { type NavItem } from './types'

// The sidebar highlights exactly one entry per group. These pin the rule
// for child pages that have no nav item of their own.

const link = (url: string): NavItem =>
  ({ title: 'menu', url }) as unknown as NavItem

/** The Inventory group, as sidebar data has it */
const inventory = [
  '/inventory',
  '/inventory/history',
  '/inventory/reports',
  '/inventory/menu-cost',
]

describe('checkIsActive', () => {
  it('lights the entry whose url the page is', () => {
    expect(
      checkIsActive('/inventory', link('/inventory'), false, inventory)
    ).toBe(true)
  })

  it('keeps a query string out of the comparison', () => {
    expect(
      checkIsActive('/inventory?page=2', link('/inventory'), false, inventory)
    ).toBe(true)
  })

  it('lights the nearest entry for a child page with no nav item of its own', () => {
    // /inventory/history/counts belongs to History, not to Stock
    const path = '/inventory/history/counts'
    expect(
      checkIsActive(path, link('/inventory/history'), false, inventory)
    ).toBe(true)
    expect(checkIsActive(path, link('/inventory'), false, inventory)).toBe(
      false
    )
  })

  it('lights every history tab under the same entry', () => {
    for (const tab of ['counts', 'purchases', 'transfers']) {
      expect(
        checkIsActive(
          `/inventory/history/${tab}`,
          link('/inventory/history'),
          false,
          inventory
        )
      ).toBe(true)
    }
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
