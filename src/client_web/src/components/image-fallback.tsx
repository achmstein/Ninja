import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageWithFallbackProps {
  src?: string | null
  className?: string
  /** Rendered inside a muted box when there is no image or it fails to load */
  fallbackIcon: React.ReactNode
  alt?: string
}

/** <img> that swaps to a placeholder when missing or broken (404 etc.). */
export function ImageWithFallback({
  src,
  className,
  fallbackIcon,
  alt = '',
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false)

  // A new src (e.g. after re-upload with a cache-busted URL) gets a fresh try
  const [prevSrc, setPrevSrc] = useState(src)
  if (prevSrc !== src) {
    setPrevSrc(src)
    setFailed(false)
  }

  if (!src || failed) {
    return (
      <div
        className={cn(
          'bg-muted flex items-center justify-center',
          className
        )}
      >
        {fallbackIcon}
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
