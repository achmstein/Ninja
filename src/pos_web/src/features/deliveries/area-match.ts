// Finding a branch's named delivery area from what the caller says: "Degla",
// "المعادي". Kept apart from the picker so it can be tested.
import type { StaffDeliveryZone } from '@ninja/api/ordering/types.gen'
import type { Language } from '@/lib/i18n'
import { normalizeName } from '@/lib/names'

/** How many areas the picker lists at once */
export const AREA_RESULTS = 8

/**
 * How well a name answers the words typed: 0 when it starts with them, 1 when
 * every word starts one of its words, 2 when every word is somewhere in it;
 * null when a word is not in it at all.
 */
function rank(name: string, query: string, words: readonly string[]): number | null {
  if (!name || !words.every((w) => name.includes(w))) return null
  if (name.startsWith(query)) return 0
  const parts = name.split(' ')
  return words.every((w) => parts.some((p) => p.startsWith(w))) ? 1 : 2
}

/**
 * The areas whose English or Arabic name has every word typed, spelling
 * variants set aside (case, accents, أ/ا, ة/ه, hyphens): the closest first,
 * a match on the name in the till's language ahead of the same match on the
 * other, and otherwise in the order the owner keeps them. Nothing typed lists
 * the first few as they are.
 */
export function matchAreas(
  zones: readonly StaffDeliveryZone[],
  query: string,
  language: Language,
  limit = AREA_RESULTS
): StaffDeliveryZone[] {
  const typed = normalizeName(query)
  if (!typed) return zones.slice(0, limit)
  const words = typed.split(' ')
  const scored: { zone: StaffDeliveryZone; score: number; index: number }[] = []
  zones.forEach((zone, index) => {
    const own = rank(normalizeName(language === 'ar' ? zone.name.ar : zone.name.en), typed, words)
    const other = rank(normalizeName(language === 'ar' ? zone.name.en : zone.name.ar), typed, words)
    const score = Math.min(own ?? Infinity, other != null ? other + 0.5 : Infinity)
    if (Number.isFinite(score)) scored.push({ zone, score, index })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.zone)
}
