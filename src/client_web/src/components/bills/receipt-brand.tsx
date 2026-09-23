import { useBrand, useBrandName, wordmarkFor } from '@/lib/brand'
import { useLanguage } from '@/lib/i18n'

/** The top of the paper, as the till prints it: the wordmark, else the
 *  logo, else the name in bold. Paper is white, so the light versions
 *  whatever the screen's scheme. */
export function ReceiptBrand() {
  const brand = useBrand()
  const brandName = useBrandName()
  const language = useLanguage((s) => s.language)
  const wordmark = wordmarkFor(brand, language, 'light')

  if (wordmark) {
    return (
      <img
        src={wordmark.url}
        alt=''
        style={{ aspectRatio: `${wordmark.width} / ${wordmark.height}` }}
        className='mb-2 block h-auto w-40 max-h-16 object-contain'
      />
    )
  }
  if (brand?.logoUrl) {
    return <img src={brand.logoUrl} alt='' className='mb-2 block h-auto w-24' />
  }
  return <div className='mb-2 text-lg font-bold tracking-tight'>{brandName}</div>
}
