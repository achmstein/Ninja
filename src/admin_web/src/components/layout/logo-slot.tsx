import { useState, type ReactNode } from 'react'
import { useBrand, useBrandName } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { BrandMark } from '@/components/brand-mark'

type Shape = 'mark' | 'wide' | 'tall'

/** What a logo is, by its own proportions: a wordmark is wide, an emblem tall, a mark about square */
function shapeOf(width: number, height: number): Shape {
  if (!width || !height) return 'mark'
  const ratio = width / height
  return ratio > 1.6 ? 'wide' : ratio < 0.7 ? 'tall' : 'mark'
}

/**
 * The business's logo in one slot of fixed height, whatever its shape, never
 * cropped or stretched: a mark (about square) stands as it is, the name
 * beside it; a wordmark (wide) stands alone, being the name, up to a width;
 * an emblem (tall) is held by the height with the name beside it. The shape
 * is read from the logo itself once it loads. No logo: the name's first
 * letter on a tile, and the name. The dark logo on a dark page.
 */
export function LogoSlot({
  showName = true,
  subtitle,
  className,
  nameClassName,
}: {
  /** A line tight under the name (the branch), beside the mark */
  subtitle?: ReactNode
  /** Off where the slot is a small icon (the collapsed rail) */
  showName?: boolean
  className?: string
  nameClassName?: string
}) {
  const brand = useBrand()
  const name = useBrandName()
  const { resolvedTheme } = useTheme()
  const logo =
    (resolvedTheme === 'dark' ? brand?.logoDarkUrl : null) ??
    brand?.logoUrl ??
    null
  const [shape, setShape] = useState<Shape>('mark')

  const sub = subtitle && (
    <span className='text-muted-foreground truncate text-xs font-normal'>
      {subtitle}
    </span>
  )
  const nameText = showName && (name || sub) && (
    <span className='flex min-w-0 flex-col leading-tight'>
      {name && (
        <span className={cn('truncate font-semibold', nameClassName)}>
          {name}
        </span>
      )}
      {sub}
    </span>
  )

  if (!logo) {
    return (
      <span className={cn('flex min-w-0 items-center gap-2', className)}>
        <BrandMark className='size-8 text-sm' />
        {nameText}
      </span>
    )
  }

  const img = (
    <img
      src={logo}
      alt={shape === 'wide' ? name : ''}
      onLoad={(e) =>
        setShape(
          shapeOf(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
        )
      }
      className={cn(
        'block object-contain',
        shape === 'wide' && 'h-7 w-auto max-w-36',
        shape === 'tall' && 'h-8 w-auto max-w-8',
        shape === 'mark' && 'size-full'
      )}
    />
  )

  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      {shape === 'mark' ? (
        // The logo on its own: no tile, no frame around it
        <span className='grid size-8 shrink-0 place-items-center'>{img}</span>
      ) : (
        img
      )}
      {/* A wordmark already says the name; the line under it stays */}
      {shape !== 'wide'
        ? nameText
        : showName &&
          sub && <span className='flex min-w-0 flex-col'>{sub}</span>}
    </span>
  )
}
