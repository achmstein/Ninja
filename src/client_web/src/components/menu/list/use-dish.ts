import { useState, type RefObject } from 'react'
import type { CatalogItemDto } from '@/api/catalog'
import { springSoft } from '@/lib/motion'
import { usePress } from '@/components/ninja/gestures/use-press'
import { canQuickAdd } from '../deck/deck-model'

/** The menu styles a café may choose instead of the deck (the brand's menu item part) */
export type MenuList = 'row' | 'card' | 'compact' | 'hero'

/**
 * What every dish of a list is given. The dish opens its options grown out
 * of its photo; its button puts a dish that needs no choosing straight in
 * the tray (and opens one that does), and a held press does the same.
 * Every dish is memoised, as the deck's cards are, and the list hands it
 * the same two handlers from render to render: a dish that renders
 * re-measures every shared layout on the page, so only the one whose
 * `opening` or `landing` changes should.
 */
export type DishProps = {
  /** The list's scroller: a dish rises in as it scrolls into it */
  scroller: RefObject<HTMLDivElement | null>
  item: CatalogItemDto
  /** Tapped: its options open out of it and close back into it */
  opening: boolean
  /** Its photo is flying to the tray from its open options */
  landing: boolean
  onOpen: (item: CatalogItemDto) => void
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

/** What every dish of a list needs: its photo (or the plate), the press, the morph into its options */
export function useDish({
  item,
  opening,
  landing = false,
  onOpen,
  onQuickAdd,
  photo,
}: Pick<DishProps, 'item' | 'opening' | 'onOpen' | 'onQuickAdd'> & { landing?: boolean; photo: RefObject<HTMLElement | null> }) {
  const [failed, setFailed] = useState(false)
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item),
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
    // Only the one being opened carries the layout ids its options grow out of; one whose photo is flying sits out
    morph: opening && !landing,
  }
}

/**
 * A dish's name in a list: the heading's family at 16 px, bold rather than the heading's extra
 * bold, so a column of names reads as dishes under the category, not as a stack of titles
 */
export const DISH_NAME = 'heading text-name [--heading-weight:700]'

/** What a dish is, under its name: 14 px, which Arabic's dots and small letters need to read */
export const DISH_NOTE = 'text-note'
