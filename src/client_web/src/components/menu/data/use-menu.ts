import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { useBranchScope, useSelectedBranch } from '@/lib/branch'
import { useBrand } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { useFavorites } from './use-favorites'
import { useMyTopItems } from './use-my-top-items'
import { buildSections, type MenuSectionData } from './sections'

export type { MenuSectionData } from './sections'

/** The menu as the page shows it, worked out once by the route. */
export type MenuData = {
  isLoading: boolean
  orderingEnabled: boolean
  /** Your usuals, favourites, most popular, then each category */
  sections: MenuSectionData[]
}

export type HomeProps = { menu: MenuData }

export function useMenuData(): MenuData {
  const t = useT()
  const localized = useLocalized()
  const branch = useSelectedBranch()
  const orderingEnabled = branch?.isOrderingEnabled ?? true

  // This branch's menu by name, each branch cached as its own (lib/branch.ts)
  const scope = useBranchScope()
  const { data: categories = [] } = useQuery({ ...listCategoriesOptions(scope.options), enabled: scope.ready })
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({ ...listItemsOptions(scope.options), enabled: scope.ready })
  // The business's choice (admin, Brand): an item that is off or sold out at this branch is either
  // shown greyed and marked unavailable, or left off the menu until it is back
  const hideSoldOut = useBrand()?.hideSoldOutItems ?? false
  const items = useMemo(() => (hideSoldOut ? allItems.filter((item) => item.isAvailable !== false) : allItems), [allItems, hideSoldOut])
  const isLoading = itemsLoading || !scope.ready
  const { favorites } = useFavorites()
  const topItemIds = useMyTopItems()

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

  return { isLoading, orderingEnabled, sections }
}
