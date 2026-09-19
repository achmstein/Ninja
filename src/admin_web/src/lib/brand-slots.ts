import type { TenantResponse, TenantWordmark } from '@/api/branch'
import type { Language } from '@/lib/i18n'

/**
 * The images a brand is made of, by slot: the square mark (light and dark)
 * and the wide wordmark per language, each with a dark version. A missing
 * slot falls back on the surfaces: dark to light, Arabic to English, the
 * wordmark to the mark and the name.
 */
export const IMAGE_SLOTS = [
  'logo',
  'logo-dark',
  'wordmark-en',
  'wordmark-en-dark',
  'wordmark-ar',
  'wordmark-ar-dark',
] as const

export type ImageSlot = (typeof IMAGE_SLOTS)[number]

export const isMark = (slot: ImageSlot) => slot.startsWith('logo')

export type Scheme = 'light' | 'dark'

export function wordmarkFor(
  brand: TenantResponse | undefined,
  language: Language,
  scheme: Scheme
): TenantWordmark | null {
  if (!brand) return null
  const w = brand.wordmarks
  const order =
    language === 'ar'
      ? scheme === 'dark'
        ? [w.arDark, w.ar, w.enDark, w.en]
        : [w.ar, w.en]
      : scheme === 'dark'
        ? [w.enDark, w.en]
        : [w.en]
  return order.find((x) => x != null) ?? null
}

export function logoFor(brand: TenantResponse | undefined, scheme: Scheme): string | null {
  if (!brand) return null
  return (scheme === 'dark' ? brand.logoDarkUrl : null) ?? brand.logoUrl ?? null
}

/** The image a slot currently holds, as the brand reports it. */
export function imageOf(brand: TenantResponse, slot: ImageSlot): { url: string; square: boolean } | null {
  const w = brand.wordmarks
  const wide = (x: TenantWordmark | null | undefined) => (x ? { url: x.url, square: false } : null)
  switch (slot) {
    case 'logo':
      return brand.logoUrl ? { url: brand.logoUrl, square: true } : null
    case 'logo-dark':
      return brand.logoDarkUrl ? { url: brand.logoDarkUrl, square: true } : null
    case 'wordmark-en':
      return wide(w.en)
    case 'wordmark-en-dark':
      return wide(w.enDark)
    case 'wordmark-ar':
      return wide(w.ar)
    case 'wordmark-ar-dark':
      return wide(w.arDark)
  }
}
