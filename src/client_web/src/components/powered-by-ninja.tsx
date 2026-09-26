import { useEffect } from 'react'
import { useBrand } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const FONT_LINK_ID = 'ninja-wordmark-font'

/**
 * "Powered by ninja", for the About dialog: the platform's wordmark in its
 * own display face, the one place a café's app carries it. The face is
 * fetched only when this shows, and only its five letters, so nothing of
 * the café's own look changes. Links to the platform when the stack knows
 * where it is.
 */
export function PoweredByNinja({ className }: { className?: string }) {
  const t = useT()
  const appsUrl = useBrand()?.appsUrl

  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Original+Surfer&text=ninja&display=swap'
    document.head.appendChild(link)
  }, [])

  const wordmark = (
    <span
      className='text-foreground text-xl leading-none'
      style={{ fontFamily: "'Original Surfer', system-ui, sans-serif", fontWeight: 400 }}
    >
      ninja
    </span>
  )

  return (
    <div className={cn('text-muted-foreground flex items-center justify-center gap-1.5 text-xs', className)}>
      <span>{t('poweredBy')}</span>
      {/* A Latin wordmark keeps its own direction on an Arabic page */}
      <span dir='ltr'>
        {appsUrl ? (
          <a href={new URL(appsUrl).origin} target='_blank' rel='noreferrer' className='hover:opacity-80'>
            {wordmark}
          </a>
        ) : (
          wordmark
        )}
      </span>
    </div>
  )
}
