import { useBrand, useBrandName } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The tenant's mark: the logo when one is uploaded, otherwise a tile in the
 * brand color with the name's first letter. Square; size it with className.
 */
export function BrandMark({ className }: { className?: string }) {
  const brand = useBrand()
  const name = useBrandName()

  if (brand?.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
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
