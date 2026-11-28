import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CatalogItemDto } from '@ninja/api/catalog/types.gen'
import { apiClient } from '@/lib/api-client'
import { toNumber } from '@/lib/money'
import { listCategoriesOptions, listItemsOptions } from './api/queries'
import { tillSuggestions, type SaleLine } from './cart'
import { itemPictureUrl } from './item-picture'

/** The attached customer's usuals, shown as a category of their own */
export const USUALS_CATEGORY = -1

/**
 * The menu as the sale screen works it: its categories and items, the one
 * open, what a typed name finds, the customer's usuals as a category of their
 * own, and ringing an item up (through its options when it has any). The
 * view is `ItemPad`; what the last item goes well with is offered under the
 * order.
 */
export function useMenu({
  customerId,
  rail,
  lines,
  onAdd,
}: {
  /** The account the sale is for, whose usuals are offered; none for a walk-in */
  customerId: string | null
  /** Categories down the side with the search always in view (a long menu on a tablet) */
  rail: boolean
  lines: readonly SaleLine[]
  onAdd: (line: SaleLine) => void
}) {
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(null)
  // Opened from a suggestion: what it adds says so
  const [customizeSuggested, setCustomizeSuggested] = useState(false)
  // The item rung up last: what it goes well with is offered under the sale
  const [lastAdded, setLastAdded] = useState<CatalogItemDto | null>(null)
  // A phone shows one category's chips at a time, so a name typed in is the
  // quicker way to an item than scrolling the row
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: categories = [] } = useQuery(listCategoriesOptions())
  const { data: items = [], isLoading } = useQuery(listItemsOptions())

  // The attached customer's most-ordered items, ranked. A walk-in (no id) or a
  // customer without enough history gets nothing; the chip then hides.
  const { data: usualIds = [] } = useQuery({
    queryKey: ['customerTopItems', customerId],
    queryFn: async () => (await apiClient.get<number[]>(`/api/catalog/customers/${customerId}/top-items`)).data,
    enabled: !!customerId,
    staleTime: 60_000,
  })
  const itemsById = new Map(items.map((i) => [Number(i.id), i]))
  const usualItems = customerId
    ? usualIds
        .map((id) => itemsById.get(Number(id)))
        .filter((i): i is CatalogItemDto => !!i && i.isAvailable !== false)
        .slice(0, 8)
    : []

  // Their usuals are a category of their own, first in the row and open by
  // default while they are attached — never a second copy of an item above
  // the category it also lives in
  useEffect(() => {
    setActiveCategory(null)
  }, [customerId])
  const sortedCategories = categories.slice().sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const firstCategoryId = sortedCategories.length > 0 ? toNumber(sortedCategories[0].id) : null
  const hasUsuals = usualItems.length > 0
  const activeCategoryId =
    activeCategory === null
      ? hasUsuals
        ? USUALS_CATEGORY
        : firstCategoryId
      : activeCategory === USUALS_CATEGORY && !hasUsuals
        ? firstCategoryId
        : activeCategory

  const needle = searchOpen || rail ? searchTerm.trim().toLowerCase() : ''
  const countIn = new Map<number, number>()
  for (const item of items) {
    const id = toNumber(item.catalogTypeId)
    countIn.set(id, (countIn.get(id) ?? 0) + 1)
  }
  const visibleItems = needle
    ? items.filter(
        (item) =>
          (item.name?.en ?? '').toLowerCase().includes(needle) || (item.name?.ar ?? '').toLowerCase().includes(needle)
      )
    : activeCategoryId === USUALS_CATEGORY
      ? usualItems
      : items
          .filter((item) => toNumber(item.catalogTypeId) === activeCategoryId)
          .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))

  /** Rings the item up; one with options asks for them first */
  const tapItem = (item: CatalogItemDto, suggested = false) => {
    if (item.customizations?.length) {
      setCustomizeSuggested(suggested)
      setCustomizeItem(item)
      return
    }
    onAdd({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: toNumber(item.effectivePrice ?? item.price),
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: 1,
      customizations: [],
      suggestion: suggested ? 'Till' : undefined,
    })
    // A suggestion taken leaves the offer as it was: it never brings on its own
    if (!suggested) setLastAdded(item)
  }

  return {
    isLoading,
    categories: sortedCategories,
    activeCategoryId,
    hasUsuals,
    usualCount: usualItems.length,
    /** How many items each category holds, for the side list */
    countIn,
    visibleItems,
    needle,
    searchOpen,
    searchTerm,
    setSearchTerm,
    openSearch: () => setSearchOpen(true),
    closeSearch: () => {
      setSearchOpen(false)
      setSearchTerm('')
    },
    pickCategory: (id: number) => {
      setActiveCategory(id)
      // Picking a category leaves the search: the side list is the way in now
      if (rail) setSearchTerm('')
    },
    tapItem,
    /** Nothing on the sale, nothing to go with */
    suggestions: lines.length === 0 ? [] : tillSuggestions(lastAdded, items, lines),
    customize: {
      item: customizeItem,
      close: () => setCustomizeItem(null),
      /** The item with its options chosen goes on the sale */
      add: (line: SaleLine) => {
        onAdd(customizeSuggested ? { ...line, suggestion: 'Till' } : line)
        if (!customizeSuggested) setLastAdded(customizeItem)
        setCustomizeItem(null)
      },
    },
  }
}

export type Menu = ReturnType<typeof useMenu>
