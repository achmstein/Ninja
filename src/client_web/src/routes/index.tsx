import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Ban, Search, X } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useLocalized, useT } from '@/lib/i18n'
import { normalizeSearch } from '@/lib/normalize'
import { Input } from '@/components/ui/input'
import { InstallBanner } from '@/components/install-banner'
import { CategoryRail, type MenuSection } from '@/components/menu/category-rail'
import { CustomizeDialog } from '@/components/menu/customize-dialog'
import { ItemRow, ItemRowSkeleton } from '@/components/menu/item-card'
import { OffersCarousel } from '@/components/menu/offers-carousel'
import { useFavorites } from '@/components/menu/use-favorites'
import { useMyTopItems } from '@/components/menu/use-my-top-items'
import { ViewCartBar } from '@/components/menu/view-cart-bar'

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
  const topItemIds = useMyTopItems()

  const offerItems = items.filter(
    (i) =>
      i.isOnOffer && Number(i.offerPrice ?? 0) < Number(i.price ?? 0)
  )

  const sections = useMemo(() => {
    const result: Array<MenuSection & { items: CatalogItemDto[] }> = []
    // "Your usuals" first — the fastest reorder for a returning customer.
    const byId = new Map(items.map((i) => [Number(i.id), i]))
    const usualItems = topItemIds
      .map((id) => byId.get(Number(id)))
      .filter((i): i is CatalogItemDto => !!i && i.isAvailable !== false)
    if (usualItems.length > 0) {
      result.push({
        id: 'section-usuals',
        label: t('yourUsuals'),
        items: usualItems,
      })
    }
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
  }, [items, categories, favorites.size, topItemIds, t, localized])

  // While a click-triggered smooth scroll runs, the spy stays quiet so it
  // can't fight the selection the user just made
  const spyPausedUntil = useRef(0)

  // Scroll-spy for the category rail: the active section is the last one
  // whose top has passed the spy line (just under the sticky rail). This is
  // deterministic — unlike IntersectionObserver's changed-entries callback,
  // it can't land on a neighbor — and at the very bottom of the page the
  // last section wins even when it's too short to ever reach the line.
  useEffect(() => {
    // Just past where a clicked section comes to rest, so it lands past the
    // line and stays selected. Read that off the section rather than repeating
    // it: the resting place is per-breakpoint and carries the safe-area inset
    const spyOffset = () => {
      const first = document.getElementById(sections[0]?.id ?? '')
      const rest = first
        ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0
        : 0
      return rest + 12
    }

    const onScroll = () => {
      if (Date.now() < spyPausedUntil.current) {
        // Still the click's own smooth scroll: keep the pause alive until the
        // events stop, so a clicked section near the bottom stays selected
        // even when the page bottoms out before it reaches the spy line
        spyPausedUntil.current = Math.max(
          spyPausedUntil.current,
          Date.now() + 150
        )
        return
      }
      const doc = document.documentElement
      // scrollY > 0 keeps this from firing on transient short layouts (e.g.
      // the remount right after clearing a search, before images size in)
      if (
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      ) {
        const last = sections[sections.length - 1]
        if (last) setActiveSection(last.id)
        return
      }
      const line = spyOffset()
      let current = sections[0]?.id ?? ''
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) current = section.id
        else break
      }
      setActiveSection(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  const term = normalizeSearch(search)
  const searchResults = term
    ? items.filter(
        (i) =>
          normalizeSearch(i.name?.en).includes(term) ||
          normalizeSearch(i.name?.ar).includes(term)
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

      <InstallBanner />

      <div className='relative'>
        <Search className='text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2' />
        <Input
          className='rounded-full pe-9 ps-9'
          placeholder={t('searchMenu')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type='button'
            aria-label={t('cancel')}
            className='text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2'
            onClick={() => setSearch('')}
          >
            <X className='h-4 w-4' />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className='flex flex-col'>
          {[...Array(8)].map((_, i) => (
            <ItemRowSkeleton key={i} />
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

          <CategoryRail
            sections={sections}
            activeId={activeSection || sections[0]?.id || ''}
            onSelect={(id) => {
              spyPausedUntil.current = Date.now() + 800
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
              // Rest exactly under the sticky rail: its own offset (the
              // safe-area inset on mobile, the brand's header on desktop) plus
              // the rail's 3.25rem. The flat 128px this replaces overshot, and
              // the surplus showed the previous category's last row
              className='flex scroll-mt-[calc(env(safe-area-inset-top)_+_3.25rem)] flex-col md:scroll-mt-[calc(var(--header-h)_+_3.25rem)]'
            >
              <h2 className='pt-2 pb-1 text-base font-bold'>{section.label}</h2>
              <div className='md:grid md:grid-cols-2 md:gap-x-10'>
                {section.items.map(renderRow)}
              </div>
            </section>
          ))}
        </>
      )}

      <ViewCartBar />

      <CustomizeDialog
        item={customizeItem}
        onOpenChange={(open) => {
          if (!open) setCustomizeItem(null)
        }}
        // Adding from a search result means the search did its job
        onAdded={() => setSearch('')}
      />
    </div>
  )
}
