import { type LocalizedValue } from '@/components/localized-input'

export const hasText = (value: string | null | undefined) =>
  (value ?? '').trim() !== ''

/** The one language that is filled in, or null when it is none or both */
export function halfFilled(value: LocalizedValue): 'en' | 'ar' | null {
  const en = hasText(value.en)
  const ar = hasText(value.ar)
  if (en === ar) return null
  return en ? 'en' : 'ar'
}

/** The API's nullable pair from form state, trimmed */
export function toSide(value: LocalizedValue): { en: string; ar: string } {
  return { en: value.en.trim(), ar: value.ar.trim() }
}
