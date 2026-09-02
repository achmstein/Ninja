import { useState } from 'react'
import { Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'

type ItemImageProps = {
  src?: string | null
  className?: string
  alt?: string
}

/**
 * A menu item's picture, or the same default the customer app shows when it
 * has none or the file fails to load (a 404 after a re-upload, a dead link):
 * the utensils mark on a muted box, so the till and the app agree on what an
 * unphotographed item looks like.
 */
export function ItemImage({ src, className, alt = '' }: ItemImageProps) {
  const [failed, setFailed] = useState(false)

  // A new src (a cache-busted URL after re-upload) gets a fresh try
  const [prevSrc, setPrevSrc] = useState(src)
  if (prevSrc !== src) {
    setPrevSrc(src)
    setFailed(false)
  }

  if (!src || failed) {
    return (
      <div className={cn('bg-muted flex items-center justify-center', className)}>
        <Utensils className='text-muted-foreground size-8' aria-hidden />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}
