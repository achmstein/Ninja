// How a delivery's address reads on one line. Pure, so it can be tested; the
// components pass the words in their language.

export type AddressParts = {
  address?: string | null
  building?: string | null
  floor?: string | null
  apartment?: string | null
}

export type AddressWords = { building: string; floor: string; apartment: string }

type ListFormatLike = {
  formatToParts(list: string[]): { type: string; value: string }[]
}

/**
 * The separator a language puts between items of a list, without its "and":
 * ", " in English, "، " in Arabic, taken from Intl so nothing hard-codes a
 * language's comma.
 */
export function listSeparator(locale: string): string {
  // Intl.ListFormat is ES2021, newer than this app's TypeScript lib: typed here, and a browser without it gets ", "
  const ListFormat = (
    Intl as unknown as {
      ListFormat?: new (locale: string, options: object) => ListFormatLike
    }
  ).ListFormat
  if (!ListFormat) return ', '
  try {
    const literal =
      new ListFormat(locale, { type: 'unit', style: 'short' })
        .formatToParts(['a', 'b', 'c'])
        .find((p) => p.type === 'literal')?.value ?? ', '
    // Some locales' unit lists say "and" between every item (Arabic's "، و"): keep the punctuation only
    const separator = literal.replace(/\p{L}+\s*$/u, '')
    return separator.trim() ? separator.replace(/\s*$/, ' ') : ', '
  } catch {
    return ', '
  }
}

/** The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3" */
export function formatAddressLine(
  parts: AddressParts,
  words: AddressWords,
  locale: string
): string {
  const details = [
    parts.building ? `${words.building} ${parts.building}` : null,
    parts.floor ? `${words.floor} ${parts.floor}` : null,
    parts.apartment ? `${words.apartment} ${parts.apartment}` : null,
  ].filter((p): p is string => p != null)
  const street = parts.address?.trim() ?? ''
  if (details.length === 0) return street
  const joined = details.join(listSeparator(locale))
  return street ? `${street} · ${joined}` : joined
}
