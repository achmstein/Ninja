// A name as the server compares it (NameSearch.Normalize in Identity.API):
// case and accents ignored, Arabic letter variants unified (أ إ آ ٱ → ا,
// ة → ه, ى ئ → ي, ؤ → و), tatweel and harakat dropped, hyphens and
// underscores read as spaces, whitespace collapsed. "Did you mean?" uses it
// to tell the cashier when a suggestion is the very name they typed.
export function normalizeName(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '') // accents, harakat, dagger alef
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[ـ'’.]/g, '')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Whether two names are the same once spelling variants are set aside. */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeName(a)
  return left.length > 0 && left === normalizeName(b)
}
