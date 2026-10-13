import { useState, type RefObject } from 'react'
import type { CatalogItemDto } from '@/api/catalog'
import { springSoft } from '@/lib/motion'
import { usePress } from '@/components/ninja/gestures/use-press'
import { useItemPreference } from '../data/use-item-preferences'
import { canQuickAdd } from '../deck/deck-model'

/** The menu styles a business may choose instead of the deck (the brand's menu item part) */
export type MenuList = 'row' | 'card' | 'compact' | 'hero'

/**
 * What every item of a list is given. The item opens its options grown out
 * of its photo (it hands the photo over; the sheet does the rest); its
 * button puts an item that needs no choosing straight in the tray (and opens
 * one that does), and a held press does the same. Every item is memoised
 * and the list hands it the same two handlers from render to render, so a
 * render of the list passes every item by.
 */
export type ItemProps = {
  /** The list's scroller: an item rises in as it scrolls into it */
  scroller: RefObject<HTMLDivElement | null>
  item: CatalogItemDto
  /** `from`: the photo its options grow out of, or null for one without (they rise in on their own) */
  onOpen: (item: CatalogItemDto, from: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
}

/** Each rises into place the first time it scrolls into view, as the deck's cards arrive */
export const rise = (scroller: ItemProps['scroller']) =>
  ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, root: scroller, margin: '0px 0px -8% 0px' },
    transition: springSoft,
  }) as const

/**
 * What every item of a list needs: its photo (or the plate), the press, opening its options. `grows`
 * off: its options do not grow out of `photo` (an item shown without one, whose `photo` is only what
 * it flies to the tray from)
 */
export function useItem({
  item,
  onOpen,
  onQuickAdd,
  photo,
  grows = true,
}: Pick<ItemProps, 'item' | 'onOpen' | 'onQuickAdd'> & { photo: RefObject<HTMLElement | null>; grows?: boolean }) {
  const [failed, setFailed] = useState(false)
  const preference = useItemPreference(Number(item.id))
  const open =() => onOpen(item, grows ? photo.current : null)
  const { pressing, handlers } = usePress({
    onTap: open,
    onLongPress: () => onQuickAdd(item, photo.current),
  })
  return {
    pressing,
    handlers,
    hasPhoto: !!item.pictureUri && !failed,
    fail: () => setFailed(true),
    soldOut: item.isAvailable === false,
    onOffer: !!item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0),
    quick: canQuickAdd(item, preference),
    open,
  }
}

/**
 * An item's name in a list: the heading's family at 16 px, bold rather than the heading's extra
 * bold, so a column of names reads as items under the category, not as a stack of titles
 */
export const ITEM_NAME = 'heading text-name [--heading-weight:700]'

/** What an item is, under its name: 14 px, which Arabic's dots and small letters need to read */
export const ITEM_NOTE = 'text-note'
