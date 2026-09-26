import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type CatalogItemDto } from '@/api/catalog'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useLocalized, useT } from '@/lib/i18n'
import { normalizeSearch } from '@/lib/normalize'
import type { ItemRowProps } from '@/components/menu/item-card'
import { useFavorites } from '@/components/menu/use-favorites'
import { useMyTopItems } from '@/components/menu/use-my-top-items'
import { buildSections, type MenuSectionData } from './sections'

export type { MenuSectionData } from './sections'

/**
 * Everything a composition of the menu page needs, worked out once by the
 * route: the sections as today's list has them, the offers, the search and
 * what it finds, the favourites, and the one customize sheet every
 * composition opens.
 */
export type MenuData = {
  isLoading: boolean
  orderingEnabled: boolean
  /** Your usuals, favourites, most popular, then each category: today's list */
  sections: MenuSectionData[]
  offerItems: CatalogItemDto[]
  search: string
  setSearch: (value: string) => void
  /** The search normalized; empty while nothing is typed */
  term: string
  searchResults: CatalogItemDto[]
  onCustomize: (item: CatalogItemDto) => void
  /** The props every item component takes, for this item */
  itemProps: (item: CatalogItemDto) => ItemRowProps
}

/** What each composition of the menu page takes; children go at the end of its column (the cart bar, the sheet). */
export type HomeProps = { menu: MenuData; children?: ReactNode }

export function useMenuData({
  search,
  setSearch,
  onCustomize,
}: {
  search: string
  setSearch: (value: string) => void
  onCustomize: (item: CatalogItemDto) => void
}): MenuData {
  const t = useT()
  const localized = useLocalized()
  const branch = useSelectedBranch()
  const orderingEnabled = branch?.isOrderingEnabled ?? true

  const { data: categories = [] } = useQuery(listCategoriesOptions())
  const { data: items = [], isLoading } = useQuery(listItemsOptions())
  const { favorites, toggle: toggleFavorite, canToggle } = useFavorites()
  const topItemIds = useMyTopItems()

  const offerItems = items.filter(
    (i) => i.isOnOffer && Number(i.offerPrice ?? 0) < Number(i.price ?? 0)
  )

  const sections = useMemo(
    () =>
      buildSections({
        items,
        categories,
        favoriteIds: favorites,
        topItemIds,
        labels: {
          usuals: t('yourUsuals'),
          favorites: t('favorites'),
          popular: t('mostPopular'),
        },
        localized,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, categories, favorites.size, topItemIds, t, localized]
  )

  const term = normalizeSearch(search)
  const searchResults = term
    ? items.filter(
        (i) =>
          normalizeSearch(i.name?.en).includes(term) ||
          normalizeSearch(i.name?.ar).includes(term)
      )
    : []

  const itemProps = (item: CatalogItemDto): ItemRowProps => ({
    item,
    isFavorite: favorites.has(Number(item.id)),
    canFavorite: canToggle,
    onToggleFavorite: toggleFavorite,
    onCustomize,
    orderingEnabled,
  })

  return {
    isLoading,
    orderingEnabled,
    sections,
    offerItems,
    search,
    setSearch,
    term,
    searchResults,
    onCustomize,
    itemProps,
  }
}
