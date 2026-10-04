// How an address reads on one line, and what an address is called. Pure, so
// both can be tested; the components pass the words in their language.

export type AddressParts = {
  address?: string | null
  building?: string | null
  floor?: string | null
  apartment?: string | null
}

export type AddressWords = { building: string; floor: string; apartment: string }

type ListFormatLike = { formatToParts(list: string[]): { type: string; value: string }[] }

/**
 * The separator a language puts between items of a list, without its "and":
 * ", " in English, "، " in Arabic, taken from Intl so nothing hard-codes a
 * language's comma.
 */
export function listSeparator(locale: string): string {
  // Intl.ListFormat is ES2021, newer than this app's TypeScript lib: typed here, and a browser without it gets ", "
  const ListFormat = (Intl as unknown as { ListFormat?: new (locale: string, options: object) => ListFormatLike }).ListFormat
  if (!ListFormat) return ', '
  try {
    const literal = new ListFormat(locale, { type: 'unit', style: 'short' }).formatToParts(['a', 'b', 'c']).find((p) => p.type === 'literal')?.value ?? ', '
    // Some locales' unit lists say "and" between every item (Arabic's "، و"): keep the punctuation only
    const separator = literal.replace(/\p{L}+\s*$/u, '')
    return separator.trim() ? separator.replace(/\s*$/, ' ') : ', '
  } catch {
    return ', '
  }
}

/** The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3" */
export function formatAddressLine(parts: AddressParts, words: AddressWords, locale: string): string {
  const details = [
    parts.building ? `${words.building} ${parts.building}` : null,
    parts.floor ? `${words.floor} ${parts.floor}` : null,
    parts.apartment ? `${words.apartment} ${parts.apartment}` : null,
  ].filter((p): p is string => p != null)
  const street = parts.address?.trim() ?? ''
  if (details.length === 0) return street
  return street ? `${street} · ${details.join(listSeparator(locale))}` : details.join(listSeparator(locale))
}

/**
 * What a saved address is called. Home and Work are kept as the words "home"
 * and "work", whatever the language, so switching language never loses which
 * is which; anything else is the customer's own name for it. Labels saved
 * before (the words themselves, in either language) still read as theirs.
 */
export type LabelKind = 'home' | 'work' | 'other'

const HOME = new Set(['home', 'البيت', 'المنزل'])
const WORK = new Set(['work', 'الشغل', 'العمل'])

export function labelKind(label: string | null | undefined): LabelKind {
  const word = (label ?? '').trim().toLowerCase()
  if (HOME.has(word)) return 'home'
  if (WORK.has(word)) return 'work'
  return 'other'
}

/** The label as it is stored: the kind's own word, or the customer's text */
export function storedLabel(kind: LabelKind, text: string): string | null {
  if (kind === 'home') return 'home'
  if (kind === 'work') return 'work'
  return text.trim() || null
}

/** The label as it reads: Home or Work in the customer's language, or their own text */
export function shownLabel(label: string | null | undefined, words: { home: string; work: string }): string | null {
  const kind = labelKind(label)
  return kind === 'home' ? words.home : kind === 'work' ? words.work : label?.trim() || null
}
