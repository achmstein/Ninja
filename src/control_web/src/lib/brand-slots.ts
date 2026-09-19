import type { BrandWordmark } from '@/api/control'
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

/** The two slots every café fills; the other four sit behind a disclosure. */
export const MAIN_SLOTS: ImageSlot[] = ['logo', 'wordmark-en']
export const VARIANT_SLOTS: ImageSlot[] = ['logo-dark', 'wordmark-en-dark', 'wordmark-ar', 'wordmark-ar-dark']

export const isMark = (slot: ImageSlot) => slot.startsWith('logo')

export type Scheme = 'light' | 'dark'

/** What the preview needs to know about the images, whatever they come from (files being picked, or the stack's URLs). */
export type BrandImages = {
  logoUrl: string | null
  logoDarkUrl: string | null
  wordmarks: {
    en: BrandWordmark | null
    enDark: BrandWordmark | null
    ar: BrandWordmark | null
    arDark: BrandWordmark | null
  }
}

export function wordmarkFor(images: BrandImages | undefined, language: Language, scheme: Scheme): BrandWordmark | null {
  if (!images) return null
  const w = images.wordmarks
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

export function logoFor(images: BrandImages | undefined, scheme: Scheme): string | null {
  if (!images) return null
  return (scheme === 'dark' ? images.logoDarkUrl : null) ?? images.logoUrl ?? null
}

/** The image a slot holds, as a URL, or null. */
export function imageOf(images: BrandImages, slot: ImageSlot): string | null {
  switch (slot) {
    case 'logo':
      return images.logoUrl
    case 'logo-dark':
      return images.logoDarkUrl
    case 'wordmark-en':
      return images.wordmarks.en?.url ?? null
    case 'wordmark-en-dark':
      return images.wordmarks.enDark?.url ?? null
    case 'wordmark-ar':
      return images.wordmarks.ar?.url ?? null
    case 'wordmark-ar-dark':
      return images.wordmarks.arDark?.url ?? null
  }
}

/**
 * Images from files picked in a form, before any stack exists: object URLs,
 * with a wordmark's box read from the file once it is loaded (until then a
 * 4:1 box, close enough for a preview).
 */
export function imagesFromUrls(urls: Partial<Record<ImageSlot, string | null>>, sizes: Partial<Record<ImageSlot, { width: number; height: number }>> = {}): BrandImages {
  const wide = (slot: ImageSlot): BrandWordmark | null => {
    const url = urls[slot]
    if (!url) return null
    const size = sizes[slot] ?? { width: 4, height: 1 }
    return { url, width: size.width, height: size.height }
  }
  return {
    logoUrl: urls.logo ?? null,
    logoDarkUrl: urls['logo-dark'] ?? null,
    wordmarks: {
      en: wide('wordmark-en'),
      enDark: wide('wordmark-en-dark'),
      ar: wide('wordmark-ar'),
      arDark: wide('wordmark-ar-dark'),
    },
  }
}
