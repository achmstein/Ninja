import { useEffect, useState } from 'react'
import { Home, Moon, Receipt, Search, Sun, User } from 'lucide-react'
import { useLanguage, useT, type Language } from '@/lib/i18n'
import { logoFor, wordmarkFor, type BrandImages, type Scheme } from '@/lib/brand-slots'
import { brandTokens, ensureFontLoaded, type BrandThemeInput } from '@/lib/brand-theme'
import { formatMoney } from '@/lib/locale'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PhoneFrame } from './phone-frame'

export type PreviewDraft = BrandThemeInput & {
  name: { en: string; ar: string }
  images: BrandImages
  currency: string
}

/** The two switches above a preview: the customer's language and the phone's scheme. */
export function PreviewToggles({
  language,
  scheme,
  onLanguage,
  onScheme,
}: {
  language: Language
  scheme: Scheme
  onLanguage: (l: Language) => void
  onScheme: (s: Scheme) => void
}) {
  const t = useT()
  return (
    <div className='flex items-center justify-center gap-2'>
      <ToggleGroup type='single' size='sm' value={language} onValueChange={(v) => v && onLanguage(v as Language)} aria-label={t('language')}>
        <ToggleGroupItem value='en' className='px-3 text-xs font-semibold'>EN</ToggleGroupItem>
        <ToggleGroupItem value='ar' className='px-3 text-xs font-semibold'>ع</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type='single' size='sm' value={scheme} onValueChange={(v) => v && onScheme(v as Scheme)} aria-label={t('theme')}>
        <ToggleGroupItem value='light' aria-label={t('light')}><Sun className='size-4' /></ToggleGroupItem>
        <ToggleGroupItem value='dark' aria-label={t('dark')}><Moon className='size-4' /></ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

/** The preview's own language and scheme, starting from the app's. */
export function usePreviewState() {
  const uiLanguage = useLanguage((s) => s.language)
  const { resolvedTheme } = useTheme()
  const [language, setLanguage] = useState<Language>(uiLanguage)
  const [scheme, setScheme] = useState<Scheme>(resolvedTheme)
  return { language, scheme, setLanguage, setScheme }
}

/**
 * The customer app's home, in miniature, painted with the draft's tokens:
 * the same CSS variables the app reads, set inline on the phone, so what
 * the form shows is what customers get once it is saved. Its own `dir` and
 * `.dark`, whatever the control app is set to.
 */
export function PhonePreview({
  draft,
  language,
  scheme,
  className,
}: {
  draft: PreviewDraft
  language: Language
  scheme: Scheme
  className?: string
}) {
  const t = useT()
  const tokens = brandTokens(draft)
  useEffect(() => ensureFontLoaded(tokens.font), [tokens.font])

  const name = (language === 'ar' ? draft.name.ar : draft.name.en) || draft.name.en || draft.name.ar || ''
  const wordmark = wordmarkFor(draft.images, language, scheme)
  const logo = logoFor(draft.images, scheme)
  const items = [
    { name: t('previewLatte'), price: 65 },
    { name: t('previewCroissant'), price: 45 },
  ]
  const style = (scheme === 'dark' ? { ...tokens.light, ...tokens.dark } : tokens.light) as React.CSSProperties

  return (
    <PhoneFrame className={className}>
      <div
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        lang={language}
        style={style}
        className={cn('bg-background text-foreground flex h-full flex-col', scheme === 'dark' && 'dark')}
      >
        <div className='flex items-center gap-2 border-b px-4 pt-7 pb-3'>
          {wordmark ? (
            <img src={wordmark.url} alt='' style={{ aspectRatio: `${wordmark.width} / ${wordmark.height}` }} className='h-6 w-auto max-w-[60%] object-contain' />
          ) : (
            <>
              {logo ? (
                <img src={logo} alt='' className='size-6 object-contain' />
              ) : (
                <span className='bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs font-semibold'>
                  {name.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className='truncate font-semibold'>{name}</span>
            </>
          )}
          <Badge variant='secondary' className='ms-auto'>{t('branches')}</Badge>
        </div>
        <div className='flex-1 space-y-3 overflow-hidden p-4'>
          <div className='flex gap-2'>
            <Badge>{t('previewPopular')}</Badge>
            <Badge variant='secondary'>{t('previewDrinks')}</Badge>
            <Badge variant='outline'>{t('previewFood')}</Badge>
            <Badge variant='outline'>{t('previewOffers')}</Badge>
          </div>
          {items.map((item) => (
            <Card key={item.name} className='flex-row items-center gap-3 p-3'>
              <div className='bg-muted aspect-square w-14 shrink-0 rounded-md' />
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>{item.name}</div>
                <div className='text-muted-foreground text-xs'>{formatMoney(item.price, draft.currency, language)}</div>
              </div>
              <Button size='sm'>{t('previewAdd')}</Button>
            </Card>
          ))}
        </div>
        <div className='bg-card text-muted-foreground flex items-center justify-around border-t px-2 py-2 text-[10px]'>
          <span className='text-primary flex flex-col items-center gap-0.5'><Home className='size-4' />{t('previewHome')}</span>
          <span className='flex flex-col items-center gap-0.5'><Search className='size-4' />{t('previewPopular')}</span>
          <span className='flex flex-col items-center gap-0.5'><Receipt className='size-4' />{t('previewOrders')}</span>
          <span className='flex flex-col items-center gap-0.5'><User className='size-4' />{t('previewProfile')}</span>
        </div>
      </div>
    </PhoneFrame>
  )
}
