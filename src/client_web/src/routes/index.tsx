import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Ban, Search } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useLocalized, useT } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryRail, type MenuSection } from '@/components/menu/category-rail'
import { CustomizeDialog } from '@/components/menu/customize-dialog'
import { DealsSection } from '@/components/menu/deals-section'
import { ItemRow } from '@/components/menu/item-card'
import { OffersCarousel } from '@/components/menu/offers-carousel'
import { useFavorites } from '@/components/menu/use-favorites'

export const Route = createFileRoute('/')({
  component: MenuPage,
})

function byDisplayOrder<T extends { displayOrder?: number | string }>(
  a: T,
  b: T
) {
  return Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
}

function MenuPage() {
  const t = useT()
  const localized = useLocalized()
  const branch = useSelectedBranch()
  const orderingEnabled = branch?.isOrderingEnabled ?? true

  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(
    null
  )

  const { data: categories = [] } = useQuery(listCategoriesOptions())
  const { data: items = [], isLoading } = useQuery(listItemsOptions())
  const { favorites, toggle: toggleFavorite, canToggle } = useFavorites()

  const offerItems = items.filter(
    (i) =>
      i.isOnOffer && Number(i.offerPrice ?? 0) < Number(i.price ?? 0)
  )

  const sections = useMemo(() => {
    const result: Array<MenuSection & { items: CatalogItemDto[] }> = []
    const favoriteItems = items.filter((i) => favorites.has(Number(i.id)))
    if (favoriteItems.length > 0) {
      result.push({
        id: 'section-favorites',
        label: t('favorites'),
        items: favoriteItems,
      })
    }
    const popular = items.filter((i) => i.isPopular)
    if (popular.length > 0) {
      result.push({
        id: 'section-popular',
        label: t('mostPopular'),
        items: popular,
      })
    }
    for (const category of [...categories].sort(byDisplayOrder)) {
      const categoryItems = items
        .filter((i) => Number(i.catalogTypeId) === Number(category.id))
        .sort(byDisplayOrder)
      if (categoryItems.length > 0) {
        result.push({
          id: `section-${category.id}`,
          label: localized(category.name),
          items: categoryItems,
        })
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, categories, favorites.size, t, localized])

  // Highlight the section currently in view on the category rail
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-140px 0px -60% 0px' }
    )
    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  const term = search.trim().toLowerCase()
  const searchResults = term
    ? items.filter(
        (i) =>
          i.name?.en?.toLowerCase().includes(term) ||
          i.name?.ar?.includes(search.trim())
      )
    : []

  const renderRow = (item: CatalogItemDto) => (
    <ItemRow
      key={String(item.id)}
      item={item}
      isFavorite={favorites.has(Number(item.id))}
      canFavorite={canToggle}
      onToggleFavorite={toggleFavorite}
      onCustomize={setCustomizeItem}
      orderingEnabled={orderingEnabled}
    />
  )

  return (
    <div className='flex flex-col gap-4 p-4'>
      {!orderingEnabled && (
        <div className='bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm font-medium'>
          <Ban className='h-4 w-4 shrink-0' />
          {t('orderingUnavailable')}
        </div>
      )}

      <div className='relative'>
        <Search className='text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2' />
        <Input
          className='rounded-full ps-9'
          placeholder={t('searchMenu')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className='flex flex-col gap-3'>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className='h-20 rounded-xl' />
          ))}
        </div>
      ) : term ? (
        searchResults.length === 0 ? (
          <p className='text-muted-foreground py-16 text-center'>
            {t('noItemsAvailable')}
          </p>
        ) : (
          <div className='md:grid md:grid-cols-2 md:gap-x-10'>
            {searchResults.map(renderRow)}
          </div>
        )
      ) : (
        <>
          <OffersCarousel
            items={offerItems}
            onCustomize={setCustomizeItem}
            orderingEnabled={orderingEnabled}
          />

          <DealsSection orderingEnabled={orderingEnabled} />

          <CategoryRail
            sections={sections}
            activeId={activeSection || sections[0]?.id || ''}
            onSelect={(id) => {
              setActiveSection(id)
              document
                .getElementById(id)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />

          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className='flex scroll-mt-32 flex-col'
            >
              <h2 className='pt-2 pb-1 text-base font-bold'>{section.label}</h2>
              <div className='md:grid md:grid-cols-2 md:gap-x-10'>
                {section.items.map(renderRow)}
              </div>
            </section>
          ))}
        </>
      )}

      <CustomizeDialog
        item={customizeItem}
        onOpenChange={(open) => {
          if (!open) setCustomizeItem(null)
        }}
      />
    </div>
  )
}
