import { useTheme } from '@/context/theme-provider'
import { useBrand, useBrandName } from '@/lib/brand'
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
  const logo = (resolvedTheme === 'dark' ? brand?.logoDarkUrl : null) ?? brand?.logoUrl ?? null

  if (logo) {
    return <img src={logo} alt='' className={cn('shrink-0 object-contain', className)} />
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
