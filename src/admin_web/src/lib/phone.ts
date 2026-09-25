// Country codes and mobile shapes of the countries PhoneRules.cs knows; the
// server's rule is the one that counts, this mirrors it so the field can say
// what it will store and look the number up as it is typed.
const COUNTRIES: Record<
  string,
  { code: string; localLength: number; mobileStart: string }
> = {
  EG: { code: '20', localLength: 10, mobileStart: '1' },
  SA: { code: '966', localLength: 9, mobileStart: '5' },
  AE: { code: '971', localLength: 9, mobileStart: '5' },
}

/** Arabic-Indic (٠-٩) and extended Arabic-Indic (۰-۹) digits read as 0-9. */
export function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0)
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660)
  })
}

/**
 * A number as it is typed, in the one form the country's pattern expects
 * (the same as PhoneRules.Normalize on the server): separators dropped,
 * 00 read as +, the country's own code or a missing trunk 0 turned back into
 * the local 0-prefixed number. Elsewhere an international number keeps its
 * plus. Empty when nothing number-like was typed.
 */
export function normalizePhone(input: string, country = 'EG'): string {
  const text = latinDigits(input.trim())
  let plus = false
  let number = ''
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') number += ch
    else if ((ch === '+' || ch === '＋') && number.length === 0) plus = true
  }
  if (number.length === 0) return ''
  if (!plus && number.startsWith('00')) {
    plus = true
    number = number.slice(2)
  }
  const rules = COUNTRIES[country.toUpperCase()]
  if (!rules) return plus ? `+${number}` : number
  const { code, localLength, mobileStart } = rules
  if (
    number.startsWith(code) &&
    (plus || number.length >= code.length + localLength)
  ) {
    let rest = number.slice(code.length)
    if (rest.startsWith('0')) rest = rest.slice(1)
    return `0${rest}`
  }
  if (!plus && number.length === localLength && number[0] === mobileStart) {
    return `0${number}`
  }
  return plus ? `+${number}` : number
}

/** The digits wa.me wants: the country code, no plus, no trunk zero. */
export function internationalDigits(phone: string, country = 'EG'): string {
  const normalized = normalizePhone(phone, country)
  if (normalized.startsWith('+')) return normalized.slice(1)
  const rules = COUNTRIES[country.toUpperCase()]
  if (rules && normalized.startsWith('0')) {
    return `${rules.code}${normalized.slice(1)}`
  }
  return normalized
}

// A WhatsApp link for a customer's phone, with an optional message. wa.me
// opens the chat in the WhatsApp app or the web client, nothing to
// integrate - staff message the customer from their own account.
export function whatsAppLink(
  phone: string,
  country = 'EG',
  text?: string
): string {
  const base = `https://wa.me/${internationalDigits(phone, country)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/**
 * A name as the server's search compares it: lower case, accents and
 * Arabic diacritics (harakat) and tatweel gone, أ إ آ ٱ → ا, ة → ه,
 * ى ئ → ي, ؤ → و, hyphens as spaces, whitespace collapsed.
 */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
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
