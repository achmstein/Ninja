import type { Language } from '@/lib/language'

/**
 * The countries a café can be in, with what each one implies: its money,
 * its clock, how a phone number starts, and which language customers
 * expect first. Picking the country fills the rest; every field can still
 * be changed by hand.
 */
export type Country = {
  code: string
  currency: string
  timeZones: string[]
  dialCode: string
  language: Language
  name: { en: string }
}

export const COUNTRIES: Country[] = [
  { code: 'EG', currency: 'EGP', timeZones: ['Africa/Cairo'], dialCode: '+20', language: 'ar', name: { en: 'Egypt' } },
  { code: 'SA', currency: 'SAR', timeZones: ['Asia/Riyadh'], dialCode: '+966', language: 'ar', name: { en: 'Saudi Arabia' } },
  { code: 'AE', currency: 'AED', timeZones: ['Asia/Dubai'], dialCode: '+971', language: 'ar', name: { en: 'United Arab Emirates' } },
  { code: 'KW', currency: 'KWD', timeZones: ['Asia/Kuwait'], dialCode: '+965', language: 'ar', name: { en: 'Kuwait' } },
  { code: 'QA', currency: 'QAR', timeZones: ['Asia/Qatar'], dialCode: '+974', language: 'ar', name: { en: 'Qatar' } },
  { code: 'BH', currency: 'BHD', timeZones: ['Asia/Bahrain'], dialCode: '+973', language: 'ar', name: { en: 'Bahrain' } },
  { code: 'OM', currency: 'OMR', timeZones: ['Asia/Muscat'], dialCode: '+968', language: 'ar', name: { en: 'Oman' } },
  { code: 'JO', currency: 'JOD', timeZones: ['Asia/Amman'], dialCode: '+962', language: 'ar', name: { en: 'Jordan' } },
  { code: 'LB', currency: 'LBP', timeZones: ['Asia/Beirut'], dialCode: '+961', language: 'ar', name: { en: 'Lebanon' } },
  { code: 'IQ', currency: 'IQD', timeZones: ['Asia/Baghdad'], dialCode: '+964', language: 'ar', name: { en: 'Iraq' } },
  { code: 'MA', currency: 'MAD', timeZones: ['Africa/Casablanca'], dialCode: '+212', language: 'ar', name: { en: 'Morocco' } },
  { code: 'TN', currency: 'TND', timeZones: ['Africa/Tunis'], dialCode: '+216', language: 'ar', name: { en: 'Tunisia' } },
  { code: 'DZ', currency: 'DZD', timeZones: ['Africa/Algiers'], dialCode: '+213', language: 'ar', name: { en: 'Algeria' } },
  { code: 'LY', currency: 'LYD', timeZones: ['Africa/Tripoli'], dialCode: '+218', language: 'ar', name: { en: 'Libya' } },
  { code: 'SD', currency: 'SDG', timeZones: ['Africa/Khartoum'], dialCode: '+249', language: 'ar', name: { en: 'Sudan' } },
  { code: 'TR', currency: 'TRY', timeZones: ['Europe/Istanbul'], dialCode: '+90', language: 'en', name: { en: 'Türkiye' } },
  { code: 'GB', currency: 'GBP', timeZones: ['Europe/London'], dialCode: '+44', language: 'en', name: { en: 'United Kingdom' } },
  { code: 'DE', currency: 'EUR', timeZones: ['Europe/Berlin'], dialCode: '+49', language: 'en', name: { en: 'Germany' } },
  { code: 'FR', currency: 'EUR', timeZones: ['Europe/Paris'], dialCode: '+33', language: 'en', name: { en: 'France' } },
  { code: 'US', currency: 'USD', timeZones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'], dialCode: '+1', language: 'en', name: { en: 'United States' } },
  { code: 'CA', currency: 'CAD', timeZones: ['America/Toronto', 'America/Vancouver'], dialCode: '+1', language: 'en', name: { en: 'Canada' } },
]

export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code)

/** What the money is called on a price tag, as the customer apps print it: `12.50 EGP` / `12.50 ج.م`. */
export const CURRENCY_LABELS: Record<string, { en: string; ar: string }> = {
  EGP: { en: 'EGP', ar: 'ج.م' },
  SAR: { en: 'SAR', ar: 'ر.س' },
  AED: { en: 'AED', ar: 'د.إ' },
  KWD: { en: 'KWD', ar: 'د.ك' },
  QAR: { en: 'QAR', ar: 'ر.ق' },
  BHD: { en: 'BHD', ar: 'د.ب' },
  OMR: { en: 'OMR', ar: 'ر.ع' },
  JOD: { en: 'JOD', ar: 'د.أ' },
  LBP: { en: 'LBP', ar: 'ل.ل' },
  IQD: { en: 'IQD', ar: 'د.ع' },
  MAD: { en: 'MAD', ar: 'د.م' },
  TND: { en: 'TND', ar: 'د.ت' },
  DZD: { en: 'DZD', ar: 'د.ج' },
  LYD: { en: 'LYD', ar: 'د.ل' },
  SDG: { en: 'SDG', ar: 'ج.س' },
  TRY: { en: 'TRY', ar: '₺' },
  GBP: { en: 'GBP', ar: '£' },
  EUR: { en: 'EUR', ar: '€' },
  USD: { en: 'USD', ar: '$' },
  CAD: { en: 'CAD', ar: 'C$' },
}

export const CURRENCIES = Object.keys(CURRENCY_LABELS)

/** Every zone the browser knows, for a café outside the list. */
export function allTimeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
}

/** The same shape every app prints: two decimals and the currency's label in the reader's language. */
export function formatMoney(value: number | string | null | undefined, currency: string, language: Language): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  const amount = (Number.isFinite(n) ? n : 0).toFixed(2)
  const label = CURRENCY_LABELS[currency]?.[language] ?? currency
  return `${amount} ${label}`
}
