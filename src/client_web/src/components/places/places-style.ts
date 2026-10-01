import { useBrand } from '@/lib/brand'
import { useDraftedPlaces } from '@/lib/preview'

/**
 * How the business lists its places on the Book tab (the brand's places part):
 * - `cards`, the default: a big card each, for a café with a few places
 * - `list`: a slim row each, many to a screen
 * - `grid`: two small tiles a row
 * Under the panel's preview, the layout it is drafting, before it is saved.
 */
export type PlacesStyle = 'cards' | 'list' | 'grid'

export function usePlacesStyle(): PlacesStyle {
  const drafted = useDraftedPlaces()
  const saved = useBrand()?.theme?.layout?.places
  const chosen = drafted === undefined ? saved : drafted
  return chosen === 'list' || chosen === 'grid' ? chosen : 'cards'
}
