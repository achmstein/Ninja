import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import type { PosterTone } from '@/components/menu/data/sections'
import { cn } from '@/lib/utils'
import { TONE_CLASS } from './deck/deck-model'

/**
 * A dish's photo, or where it has none (or it will not load) a plate on a
 * tone of the business's palette: the same stand-in in the tray, its order and
 * the dish's options as on the classic menu, so a dish without a photo
 * never shows as an empty circle or a lone letter.
 */
export function DishPhoto({
  src,
  tone = 'primary',
  className,
  iconClassName,
}: {
  src: string | null | undefined
  tone?: PosterTone
  className?: string
  iconClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  // A new photo gets a fresh try
  const [tried, setTried] = useState(src)
  if (tried !== src) {
    setTried(src)
    setFailed(false)
  }
  if (!src || failed) {
    return (
      <span aria-hidden className={cn('grid size-full place-items-center', TONE_CLASS[tone], className)}>
        <UtensilsCrossed className={cn('size-1/2 opacity-60', iconClassName)} />
      </span>
    )
  }
  return <img src={src} alt='' draggable={false} onError={() => setFailed(true)} className={cn('size-full object-cover', className)} />
}
