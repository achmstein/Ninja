import { useTheme } from '@/context/theme-provider'
import { useBrand, useBrandName } from '@/lib/brand'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * The café's mark on a staff surface: its logo when one is uploaded (the
 * dark one on a dark page), otherwise a neutral tile with the name's first
 * letter. The staff apps keep the neutral theme, so the tile is ink on
 * paper rather than the brand colour. Square; size it with className.
 */
export function BrandMark({ className }: { className?: string }) {
  const brand = useBrand()
  const name = useBrandName()
  const { resolvedTheme } = useTheme()
  const darkLogo = resolvedTheme === 'dark' ? brand?.logoDarkUrl : null
  const logo = darkLogo ?? brand?.logoUrl ?? null

  if (logo) {
    // A light-page logo on a dark page sits on a paper chip so dark ink stays visible
    const chip = resolvedTheme === 'dark' && !darkLogo
    return (
      <img
        src={logo}
        alt=''
        className={cn('shrink-0 object-contain', chip && 'rounded-md bg-white p-0.5', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'bg-foreground text-background grid shrink-0 place-items-center rounded-md font-semibold leading-none',
        className
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  )
}

/**
 * The café's wide lockup for the header, the way the customer app picks it:
 * the wordmark for this language and scheme (the dark one falling back to
 * the light one, Arabic to English), else the square logo. Null when the
 * café has neither, and the mark and name stand in.
 */
export function useBrandLockup(): { url: string; chip: boolean } | null {
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  const { resolvedTheme } = useTheme()
  if (!brand) return null
  const dark = resolvedTheme === 'dark'
  // A brand cached by an older build has no wordmarks
  const w = brand.wordmarks ?? { en: null, enDark: null, ar: null, arDark: null }
  const words =
    language === 'ar'
      ? dark
        ? [w.arDark, w.ar, w.enDark, w.en]
        : [w.ar, w.en]
      : dark
        ? [w.enDark, w.en]
        : [w.en]
  // Only a light-page image on a dark page needs the paper chip
  const word = words.find((x) => x != null)
  if (word) return { url: word.url, chip: dark && word !== w.arDark && word !== w.enDark }
  const logo = (dark ? brand.logoDarkUrl : null) ?? brand.logoUrl
  if (logo) return { url: logo, chip: dark && !brand.logoDarkUrl }
  return null
}

/** The lockup as an image sized to its row's height, never stretched. */
export function BrandLockup({
  lockup,
  alt,
  className,
}: {
  lockup: { url: string; chip: boolean }
  alt: string
  className?: string
}) {
  return (
    <img
      src={lockup.url}
      alt={alt}
      className={cn(
        'h-9 w-auto max-w-40 shrink-0 object-contain',
        lockup.chip && 'rounded-md bg-white px-1.5 py-1',
        className
      )}
    />
  )
}
