import { create } from 'zustand'
import { useLanguage } from '@/lib/i18n'

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
export const useCurrency = create<{
  code: string
  set: (code: string) => void
}>()((set) => ({
  code: DEFAULT_CURRENCY,
  set: (code) => set({ code: code || DEFAULT_CURRENCY }),
}))

export function currencyLabel(code: string, language: 'en' | 'ar'): string {
  return CURRENCY_LABELS[code]?.[language] ?? code
}

const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Two decimals grouped in thousands (10,820.00) and the currency's label in
 * the reader's language, the shape every app prints. Figures stay western,
 * a loss takes a true minus, and the figure is held left to right so in an
 * Arabic line the minus stays before it (−10,481.35 ج.م).
 */
export function formatMoney(
  value: number | string | null | undefined,
  code: string,
  language: 'en' | 'ar',
  /** A + before a gain, inside the figure so it stays with it */
  signed = false
): string {
  const raw = typeof value === 'string' ? Number(value) : (value ?? 0)
  const n = Number.isFinite(raw) ? raw : 0
  const figure = `${n < 0 ? '−' : signed && n > 0 ? '+' : ''}${AMOUNT.format(Math.abs(n))}`
  return `⁦${figure}⁩ ${currencyLabel(code, language)}`
}

/** The label alone ("EGP" / "ج.م"), for a price input's unit. */
export function useCurrencyLabel(): string {
  const language = useLanguage((s) => s.language)
  const code = useCurrency((s) => s.code)
  return currencyLabel(code, language)
}
