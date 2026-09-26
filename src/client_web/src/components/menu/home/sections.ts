import type { CatalogItemDto, LocalizedText } from '@/api/catalog'

/** What a section of the menu is: the customer's own picks, the café's most popular, or one of its categories. */
export type SectionKind = 'usuals' | 'favorites' | 'popular' | 'offers' | 'category'

export type MenuSectionData = {
  /** Also the section's element id on the page */
  id: string
  label: string
  kind: SectionKind
  items: CatalogItemDto[]
}

type Category = { id?: number | string; name?: LocalizedText | null; displayOrder?: number | string }

function byDisplayOrder<T extends { displayOrder?: number | string }>(a: T, b: T) {
  return Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
}

/**
 * The menu's sections in today's order: your usuals first (the fastest
 * reorder for a returning customer), then favourites, the most popular, and
 * each category that has anything in it.
 */
export function buildSections({
  items,
  categories,
  favoriteIds,
  topItemIds,
  labels,
  localized,
}: {
  items: CatalogItemDto[]
  categories: Category[]
  favoriteIds: ReadonlySet<number>
  topItemIds: Array<number | string>
  labels: { usuals: string; favorites: string; popular: string }
  localized: (text: LocalizedText | null | undefined) => string
}): MenuSectionData[] {
  const result: MenuSectionData[] = []
  const byId = new Map(items.map((i) => [Number(i.id), i]))
  const usualItems = topItemIds
    .map((id) => byId.get(Number(id)))
    .filter((i): i is CatalogItemDto => !!i && i.isAvailable !== false)
  if (usualItems.length > 0) {
    result.push({ id: 'section-usuals', label: labels.usuals, kind: 'usuals', items: usualItems })
  }
  const favoriteItems = items.filter((i) => favoriteIds.has(Number(i.id)))
  if (favoriteItems.length > 0) {
    result.push({ id: 'section-favorites', label: labels.favorites, kind: 'favorites', items: favoriteItems })
  }
  const popular = items.filter((i) => i.isPopular)
  if (popular.length > 0) {
    result.push({ id: 'section-popular', label: labels.popular, kind: 'popular', items: popular })
  }
  for (const category of [...categories].sort(byDisplayOrder)) {
    const categoryItems = items
      .filter((i) => Number(i.catalogTypeId) === Number(category.id))
      .sort(byDisplayOrder)
    if (categoryItems.length > 0) {
      result.push({
        id: `section-${category.id}`,
        label: localized(category.name),
        kind: 'category',
        items: categoryItems,
      })
    }
  }
  return result
}

const hasPhoto = (item: CatalogItemDto) => !!item.pictureUri

/**
 * The dish a showcase opens with: the best offer that has a photo, else the
 * first popular one with a photo, else any available item with a photo;
 * null when nothing has a photo (the café's cover stands in).
 */
export function pickHero(offers: CatalogItemDto[], sections: MenuSectionData[]): CatalogItemDto | null {
  const available = (i: CatalogItemDto) => i.isAvailable !== false
  const saving = (i: CatalogItemDto) => Number(i.price ?? 0) - Number(i.offerPrice ?? i.price ?? 0)
  const offer = [...offers].filter((i) => available(i) && hasPhoto(i)).sort((a, b) => saving(b) - saving(a))[0]
  if (offer) return offer
  const popular = sections.find((s) => s.kind === 'popular')?.items.find((i) => available(i) && hasPhoto(i))
  if (popular) return popular
  for (const section of sections) {
    const any = section.items.find((i) => available(i) && hasPhoto(i))
    if (any) return any
  }
  return null
}

/**
 * The tiles a category-first home shows: offers and your usuals first when
 * there are any, then favourites and each category. Most popular is left
 * out: on a tile grid it is a list of dishes, not a place to go.
 */
export function tileSections(
  sections: MenuSectionData[],
  offers: CatalogItemDto[],
  offersLabel: string
): MenuSectionData[] {
  const tiles: MenuSectionData[] = []
  if (offers.length > 0) tiles.push({ id: 'section-offers', label: offersLabel, kind: 'offers', items: offers })
  const usuals = sections.find((s) => s.kind === 'usuals')
  if (usuals) tiles.push(usuals)
  for (const s of sections) if (s.kind === 'favorites' || s.kind === 'category') tiles.push(s)
  return tiles
}

/** The picture a tile wears: its first item's that has one, or none (a brand-colour panel with the initial). */
export function coverItem(section: MenuSectionData): CatalogItemDto | null {
  return section.items.find(hasPhoto) ?? null
}

export const POSTER_TONES = ['primary', 'secondary', 'deep'] as const
export type PosterTone = (typeof POSTER_TONES)[number]

/** The colour block a poster gives its nth block: primary, accent, a darkened primary, and round again (the masthead is block 0). */
export function posterTone(index: number): PosterTone {
  return POSTER_TONES[((index % POSTER_TONES.length) + POSTER_TONES.length) % POSTER_TONES.length]
}
