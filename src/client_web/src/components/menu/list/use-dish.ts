import { useState, type RefObject } from 'react'
import type { CatalogItemDto } from '@/api/catalog'
import { springSoft } from '@/lib/motion'
import { usePress } from '@/components/ninja/gestures/use-press'
import { canQuickAdd } from '../deck/deck-model'

/** The menu styles a business may choose instead of the deck (the brand's menu item part) */
export type MenuList = 'row' | 'card' | 'compact' | 'hero'

/**
 * What every dish of a list is given. The dish opens its options grown out
 * of its photo (it hands the photo over; the sheet does the rest); its
 * button puts a dish that needs no choosing straight in the tray (and opens
 * one that does), and a held press does the same. Every dish is memoised
 * and the list hands it the same two handlers from render to render, so a
 * render of the list passes every dish by.
 */
export type DishProps = {
  /** The list's scroller: a dish rises in as it scrolls into it */
  scroller: RefObject<HTMLDivElement | null>
  item: CatalogItemDto
  /** `from`: the photo its options grow out of, or null for one without (they rise in on their own) */
  onOpen: (item: CatalogItemDto, from: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
}

/** Each rises into place the first time it scrolls into view, as the deck's cards arrive */
export const rise = (scroller: DishProps['scroller']) =>
  ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, root: scroller, margin: '0px 0px -8% 0px' },
    transition: springSoft,
  }) as const

/**
 * What every dish of a list needs: its photo (or the plate), the press, opening its options. `grows`
 * off: its options do not grow out of `photo` (a dish shown without one, whose `photo` is only what
 * it flies to the tray from)
 */
export function useDish({
  item,
  onOpen,
  onQuickAdd,
  photo,
  grows = true,
}: Pick<DishProps, 'item' | 'onOpen' | 'onQuickAdd'> & { photo: RefObject<HTMLElement | null>; grows?: boolean }) {
  const [failed, setFailed] = useState(false)
  const open = () => onOpen(item, grows ? photo.current : null)
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
    quick: canQuickAdd(item),
    open,
  }
}

/**
 * A dish's name in a list: the heading's family at 16 px, bold rather than the heading's extra
 * bold, so a column of names reads as dishes under the category, not as a stack of titles
 */
export const DISH_NAME = 'heading text-name [--heading-weight:700]'

/** What a dish is, under its name: 14 px, which Arabic's dots and small letters need to read */
export const DISH_NOTE = 'text-note'
