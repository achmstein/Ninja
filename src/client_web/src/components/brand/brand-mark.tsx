import { useBrandLogo, useBrandName, useBrandWordmark } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The tenant's mark: the logo when one is uploaded (the dark one on a dark
 * page), otherwise a tile in the brand color with the name's first letter.
 * Square; size it with className.
 */
export function BrandMark({ className }: { className?: string }) {
  const logo = useBrandLogo()
  const name = useBrandName()

  if (logo) {
    return (
      <img
        src={logo}
        alt=''
        className={cn('shrink-0 object-contain', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-md font-semibold leading-none',
        className
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * The brand as a header shows it: the wide logo for the page's language and
 * scheme when the tenant uploaded one (its box reserved from the stored
 * size, so nothing jumps), otherwise the mark beside the name. `className`
 * sizes the wordmark by height.
 */
export function BrandWordmark({
  className,
  markClassName,
  textClassName,
}: {
  className?: string
  markClassName?: string
  textClassName?: string
}) {
  const wordmark = useBrandWordmark()
  const name = useBrandName()

  if (wordmark) {
    const { url, width, height } = wordmark
    return (
      <img
        src={url}
        alt={name}
        style={{ aspectRatio: `${width} / ${height}` }}
        className={cn('block h-(--wordmark-h) w-auto max-w-full object-contain', className)}
      />
    )
  }

  return (
    <>
      <BrandMark className={cn('size-7 text-sm', markClassName)} />
      <span className={cn('truncate text-lg font-semibold tracking-tight', textClassName)}>
        {name}
      </span>
    </>
  )
}
