// Phone numbers as the till types them. The rules mirror the server's
// PhoneRules.Normalize (src/Ninja.ServiceDefaults/PhoneRules.cs), so what
// the cashier sees under the field is what Identity will store and match.

type CountryRule = { code: string; localLength: number; mobileStart: string }

const RULES: Record<string, CountryRule> = {
  EG: { code: '20', localLength: 10, mobileStart: '1' },
  SA: { code: '966', localLength: 9, mobileStart: '5' },
  AE: { code: '971', localLength: 9, mobileStart: '5' },
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits as 0-9; everything else untouched. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

/**
 * The one form of a number in the café's country: separators dropped, 00
 * read as +, the country's own code (+20, +966, +971) or a missing trunk 0
 * turned back into the local 0-number; elsewhere an international number
 * keeps its plus. Empty when nothing number-like was typed.
 */
export function normalizePhone(input: string, country = 'EG'): string {
  const text = toLatinDigits(input.trim())
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

  const rule = RULES[country.toUpperCase()]
  if (!rule) return plus ? `+${number}` : number

  if (
    number.startsWith(rule.code) &&
    (plus || number.length >= rule.code.length + rule.localLength)
  ) {
    let rest = number.slice(rule.code.length)
    if (rest.startsWith('0')) rest = rest.slice(1)
    return `0${rest}`
  }
  if (!plus && number.length === rule.localLength && number[0] === rule.mobileStart) {
    return `0${number}`
  }
  return plus ? `+${number}` : number
}

/** How many digits have been typed, whatever the script: when a lookup is worth making. */
export function digitCount(input: string): number {
  return toLatinDigits(input).replace(/\D/g, '').length
}

/** The number as WhatsApp wants it: country code first, no plus, no trunk 0. */
export function internationalDigits(phone: string, country = 'EG'): string {
  const normalized = normalizePhone(phone, country)
  if (normalized.startsWith('+')) return normalized.slice(1)
  const rule = RULES[country.toUpperCase()]
  if (rule && normalized.startsWith('0')) return `${rule.code}${normalized.slice(1)}`
  // An Egyptian mobile typed at a till with no country on file
  if (normalized.length === 11 && normalized.startsWith('01')) return `20${normalized.slice(1)}`
  return normalized
}

// A WhatsApp link for a phone as customers type it here: the local number
// gets its country code, an international one keeps its own. wa.me opens
// the chat in the WhatsApp app or the web client, nothing to integrate -
// staff message the customer from their own account.
export function whatsAppLink(phone: string, text?: string, country = 'EG'): string {
  const url = `https://wa.me/${internationalDigits(phone, country)}`
  return text ? `${url}?text=${encodeURIComponent(text)}` : url
}
