import { create } from 'zustand'

/** What the money is called on a price tag, in each language: `12.50 EGP` / `12.50 ج.م`. */
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

export const DEFAULT_CURRENCY = 'EGP'

/** The tenant's currency (ISO 4217), set by the brand when it loads; pounds until then. */
export const useCurrency = create<{ code: string; set: (code: string) => void }>()((set) => ({
  code: DEFAULT_CURRENCY,
  set: (code) => set({ code: code || DEFAULT_CURRENCY }),
}))

export function currencyLabel(code: string, language: 'en' | 'ar'): string {
  return CURRENCY_LABELS[code]?.[language] ?? code
}

/** Two decimals and the currency's label in the reader's language, the shape every app prints. */
export function formatMoney(value: number | string | null | undefined, code: string, language: 'en' | 'ar'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${currencyLabel(code, language)}`
}

/** `12 EGP`: a rate, a tariff, anything quoted without its piastres. */
export function formatMoneyWhole(value: number | string | null | undefined, code: string, language: 'en' | 'ar'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return `${(Number.isFinite(n) ? n : 0).toFixed(0)} ${currencyLabel(code, language)}`
}
