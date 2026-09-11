/**
 * Normalize text for menu search: lowercase, strip Latin and Arabic diacritics
 * and tatweel, and unify Arabic letter variants (أإآ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي).
 * Lets "قهوه" match "قهوة" and ignores case/accents — smarter matching without
 * a full fuzzy engine. Kept intentionally small so both apps can carry a copy.
 */
export function normalizeSearch(input: string | null | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin combining marks (é → e)
    .replace(/[ً-ْٰـ]/g, '') // Arabic harakat + tatweel
    .replace(/[أإآ]/g, 'ا') // أإآ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
    .replace(/ة/g, 'ه') // ة → ه
    .trim()
}
