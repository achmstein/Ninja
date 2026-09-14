// Small text similarity for matching what a receipt says to what the
// system knows (a supplier name printed one way, saved another). Names
// are normalised the same way the server's matcher does: lower-case, no
// diacritics, Arabic letter forms folded, digits Western.

function normalizeName(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Latin diacritics
    .replace(/[\u064b-\u0652\u0640]/g, '') // tashkeel, tatweel
    .replace(/[آأإٱ]/g, 'ا') // alef forms
    .replace(/ة/g, 'ه') // ta marbuta → ha
    .replace(/ى/g, 'ي') // alef maqsura → ya
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** 0–1: token overlap, with a bonus when one name contains the other */
function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  let overlap = 0
  for (const token of ta) if (tb.has(token)) overlap++
  const jaccard = overlap / (ta.size + tb.size - overlap)
  const contains = na.includes(nb) || nb.includes(na) ? 0.5 : 0
  return Math.min(1, jaccard + contains)
}

/** The best candidate at or above the threshold, or null */
export function bestMatch<T>(
  query: string | null | undefined,
  candidates: T[],
  nameOf: (candidate: T) => string,
  threshold = 0.75
): T | null {
  if (!query) return null
  let best: T | null = null
  let bestScore = 0
  for (const candidate of candidates) {
    const score = similarity(query, nameOf(candidate))
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return bestScore >= threshold ? best : null
}
