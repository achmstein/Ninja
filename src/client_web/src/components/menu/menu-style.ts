import { useBrand } from '@/lib/brand'
import { useDraftedMenuItem } from '@/lib/preview'
import type { MenuList } from './list/dishes'

/**
 * How the business shows its menu (the brand's menu item part):
 * - `deck`: big cards to swipe, pinched out to a grid of small tiles
 * - `tiles`: that grid of small tiles alone, the whole menu from the start
 * - a list (`row`, the default; `card`, `compact`, `hero`): the business's own
 *   menu, a page of dishes under their categories
 * A menu is scanned and compared, which a list lets the eye do, so a list
 * is what a business gets when it picks nothing; the cards to swipe are its own
 * choice, for a short menu with a photo of every dish. Under the panel's
 * preview, the style it is drafting, before it is saved.
 */
export type MenuStyle = { kind: 'deck' } | { kind: 'tiles' } | { kind: 'list'; list: MenuList }

export function useMenuStyle(): MenuStyle {
  const drafted = useDraftedMenuItem()
  const saved = useBrand()?.theme?.layout?.menuItem
  const chosen = drafted === undefined ? saved : drafted
  if (chosen === 'deck') return { kind: 'deck' }
  if (chosen === 'tiles') return { kind: 'tiles' }
  if (chosen === 'card' || chosen === 'compact' || chosen === 'hero') return { kind: 'list', list: chosen }
  return { kind: 'list', list: 'row' }
}
