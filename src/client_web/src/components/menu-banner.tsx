import { useBrand, useBrandName, logoFor, wordmarkFor } from '@/lib/brand'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BrandWordmark } from '@/components/brand-mark'

/**
 * The banner header: the café's cover photo across the top of the menu with
 * the brand over it. On the photo a dark scrim sits under the brand, so it
 * takes the dark scheme's wordmark or mark whatever the page is in. Without
 * a cover the brand sits large on a soft panel of its accent.
 * `children` go in the top corner (the place and branch chips on a phone).
 */
export function MenuBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  const brand = useBrand()
  const name = useBrandName()
  const language = useLanguage((s) => s.language)
  const cover = brand?.cover

  if (!cover) {
    return (
      <div className={cn('bg-accent text-accent-foreground relative flex flex-col items-center justify-center gap-3 px-4 py-8', className)}>
        {children && <div className='absolute end-4 top-3 flex items-center gap-2 empty:hidden'>{children}</div>}
        <div className='flex items-center gap-3 [--wordmark-h:calc(var(--header-h)*0.9)]'>
          <BrandWordmark markClassName='size-12 text-xl rounded-xl' textClassName='heading text-2xl' />
        </div>
      </div>
    )
  }

  // Over the scrim the brand is always light: the dark scheme's images
  const wordmark = wordmarkFor(brand, language, 'dark')
  const logo = logoFor(brand, 'dark')

  return (
    <div className={cn('relative isolate flex min-h-44 flex-col justify-end overflow-hidden', className)}>
      <img src={cover.url} alt='' className='absolute inset-0 -z-10 size-full object-cover' />
      <div aria-hidden className='absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-black/10' />
      {children && <div className='absolute end-4 top-3 flex items-center gap-2 empty:hidden'>{children}</div>}
      <div className='flex items-center gap-3 px-5 pt-16 pb-5 text-white'>
        {wordmark ? (
          <img
            src={wordmark.url}
            alt={name}
            style={{ aspectRatio: `${wordmark.width} / ${wordmark.height}` }}
            className='block h-[calc(var(--wordmark-h)*1.25)] w-auto max-w-[70%] object-contain drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]'
          />
        ) : (
          <>
            {logo && <img src={logo} alt='' className='size-12 shrink-0 object-contain drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]' />}
            <span className='heading truncate text-2xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]'>{name}</span>
          </>
        )}
      </div>
    </div>
  )
}
