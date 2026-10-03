import { type LocalizedText } from '@/api/catalog'

export type Lang = 'en' | 'ar'

/** Both languages as plain strings, the shape a form keeps in state */
export type LocalizedValue = { en: string; ar: string }

/** From the API's nullable pair to form state */
export function toLocalizedValue(
  text: LocalizedText | null | undefined
): LocalizedValue {
  return { en: text?.en ?? '', ar: text?.ar ?? '' }
}

/**
 * Back to the API's shape: trimmed, an empty side becomes null. A business
 * may write in one language only, so either side may be the one missing.
 */
export function fromLocalizedValue(value: LocalizedValue): {
  en: string | null
  ar: string | null
} {
  return { en: value.en.trim() || null, ar: value.ar.trim() || null }
}

/**
 * Whichever language is written, English first: for keys, prompts and
 * matching outside a component (a component reads with useLocalized).
 */
export function primaryText(text: LocalizedText | null | undefined): string {
  return text?.en?.trim() || text?.ar?.trim() || ''
}

const ARABIC_LETTER =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/**
 * A text whose language nobody said (a line read off a receipt): Arabic
 * script goes to the Arabic side, anything else to the English one.
 */
export function inScriptOf(text: string): LocalizedValue {
  return ARABIC_LETTER.test(text) ? { en: '', ar: text } : { en: text, ar: '' }
}

/** Neither language is written: what a required name refuses */
export function isBlank(value: LocalizedValue): boolean {
  return value.en.trim() === '' && value.ar.trim() === ''
}
