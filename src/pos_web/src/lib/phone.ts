// Phone numbers as staff type them, a customer gave them or a contact book
// saved them. The same rule as the server's PhoneRules
// (src/Ninja.ServiceDefaults/PhoneRules.cs), on the same numbering plans
// (libphonenumber): a number is read against the business's country however
// it is spelled, and sent and kept in the one international form,
// +201012345678. Screens show it the local way.
//
// The mobile build of the plans: to it a number is valid when it is one a
// mobile can have, which is the rule for a customer's number.
import {
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/mobile'

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits as 0-9; everything else untouched. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

/** What was typed with only what a number is made of: digits, a leading plus, 00 read as one. */
function clean(input: string): string {
  const text = toLatinDigits(input.trim())
  let plus = false
  let digits = ''
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') digits += ch
    else if ((ch === '+' || ch === '＋') && digits.length === 0) plus = true
  }
  if (digits.length === 0) return ''
  if (!plus && digits.startsWith('00')) {
    plus = true
    digits = digits.slice(2)
  }
  return plus ? `+${digits}` : digits
}

function region(country: string): CountryCode | undefined {
  const code = country.trim().toUpperCase()
  return isSupportedCountry(code) ? code : undefined
}

/**
 * The number the text spells, read against the business's country, or
 * against its own country code when it carries one. Undefined when it spells
 * none; what comes back may still not be a real number (see isValidPhone).
 */
export function readPhone(
  input: string | null | undefined,
  country: string
): PhoneNumber | undefined {
  let text = clean(input ?? '')
  if (!text) return undefined
  // +020…, as some forms and contact books write +20: no country code starts with a zero
  if (text.startsWith('+')) text = `+${text.slice(1).replace(/^0+/, '')}`
  const home = region(country)
  if (!home && !text.startsWith('+')) return undefined
  return parsePhoneNumberFromString(text, home)
}

/** Whether this is a customer's number here: a mobile of the business's country, in any spelling. */
export function isValidPhone(
  input: string | null | undefined,
  country: string
): boolean {
  const number = readPhone(input, country)
  if (!number?.isValid()) return false
  const home = region(country)
  return !home || number.country === home
}

/**
 * The number in the one form it is sent and kept in (+201012345678) when it
 * is a customer's number here; otherwise what was typed without its
 * separators, which the server will refuse. Empty when nothing number-like
 * was typed.
 */
export function normalizePhone(
  input: string | null | undefined,
  country: string
): string {
  return isValidPhone(input, country)
    ? readPhone(input, country)!.number
    : clean(input ?? '')
}

/**
 * A kept number as people here write it: 010 12345678 for one of the
 * business's country, +44 7400 123456 for one from abroad. What is not a
 * number (a hotline's 19019, a note) is shown as it is.
 */
export function formatPhone(
  stored: string | null | undefined,
  country: string
): string {
  const text = stored?.trim() ?? ''
  const number = readPhone(text, country)
  if (!number?.isPossible()) return text
  return number.country === region(country)
    ? number.formatNational()
    : number.formatInternational()
}

// The business's country, set when its brand lands (lib/brand): what a kept
// number is shown against wherever one is drawn.
let home = 'EG'

export function setPhoneCountry(country: string | null | undefined): void {
  home = country || 'EG'
}

/**
 * A kept number as people here write it (010 12345678, or +44 … for one from
 * abroad), for showing. It comes inside a left-to-right isolate: a number is
 * all digits and spaces, which have no direction of their own, so in an
 * Arabic line its groups would otherwise swap places (12345678 010) wherever
 * the element was not told dir="ltr". For a field's value use editablePhone.
 */
export function showPhone(stored: string | null | undefined): string {
  const shown = formatPhone(stored, home)
  return shown ? `\u2066${shown}\u2069` : shown
}

/** The same number bare, for a field someone types in or text that is searched. */
export function editablePhone(stored: string | null | undefined): string {
  return formatPhone(stored, home)
}

/** How many digits have been typed, whatever the script: when a lookup is worth making. */
export function digitCount(input: string): number {
  return toLatinDigits(input).replace(/\D/g, '').length
}

/** The number as WhatsApp wants it: country code first, no plus, no trunk 0. */
export function internationalDigits(phone: string, country = home): string {
  const number = readPhone(phone, country)
  return number?.isPossible()
    ? number.number.slice(1)
    : clean(phone).replace('+', '')
}

// A WhatsApp link for a phone as customers gave it here: the local number
// gets its country code, an international one keeps its own. wa.me opens
// the chat in the WhatsApp app or the web client, nothing to integrate -
// staff message the customer from their own account.
export function whatsAppLink(phone: string, text?: string, country = home): string {
  const url = `https://wa.me/${internationalDigits(phone, country)}`
  return text ? `${url}?text=${encodeURIComponent(text)}` : url
}

/** The number for a line of running text ("Guest · 010 0021 2204"): showPhone, which isolates it. */
export const phoneInText = showPhone
