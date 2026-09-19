import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ImagePlus, X } from 'lucide-react'
import { AxiosError } from 'axios'
import { type TenantFeatures, type TenantThemeDto } from '@/api/branch'
import {
  deleteTenantImageMutation,
  updateTenantMutation,
  uploadTenantImageMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { useCurrencyLabel } from '@/lib/currency'
import { brandQueryKey, useBrand, type Brand } from '@/lib/brand'
import { imageOf, isMark, wordmarkFor, type ImageSlot } from '@/lib/brand-slots'
import { brandTokens, ensureFontLoaded, FONTS, RADII } from '@/lib/brand-theme'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Main } from '@/components/layout/main'
import {
  LocalizedInput,
  fromLocalizedValue,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { PageHeader } from '@/components/page-header'

const FEATURE_ROWS: { key: keyof TenantFeatures; label: TranslationKey }[] = [
  { key: 'rooms', label: 'featureRooms' },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
]

/** The two slots every café fills, then the four variants behind a disclosure. */
const MAIN_SLOTS: { slot: ImageSlot; label: TranslationKey }[] = [
  { slot: 'logo', label: 'brandLogo' },
  { slot: 'wordmark-en', label: 'brandWordmarkEn' },
]

const VARIANT_SLOTS: { slot: ImageSlot; label: TranslationKey }[] = [
  { slot: 'logo-dark', label: 'brandLogoDark' },
  { slot: 'wordmark-en-dark', label: 'brandWordmarkEnDark' },
  { slot: 'wordmark-ar', label: 'brandWordmarkAr' },
  { slot: 'wordmark-ar-dark', label: 'brandWordmarkArDark' },
]

const RADIUS_LABELS: Record<string, TranslationKey> = {
  none: 'radiusNone',
  sm: 'radiusSm',
  md: 'radiusMd',
  lg: 'radiusLg',
  xl: 'radiusXl',
}

const DEFAULT_COLOR = '#18181b'
const NONE = '__default__'

/** The server's one-line reason, when the error carried ProblemDetails. */
function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  const data = e.response?.data as { detail?: string } | undefined
  return data?.detail
}

type ThemeForm = {
  accent: string
  background: string
  foreground: string
  radius: string
  font: string
}

const toThemeForm = (t: TenantThemeDto): ThemeForm => ({
  accent: t.accent ?? '',
  background: t.background ?? '',
  foreground: t.foreground ?? '',
  radius: t.radius ?? '',
  font: t.font ?? '',
})

const fromThemeForm = (f: ThemeForm): TenantThemeDto => ({
  accent: f.accent.trim() || null,
  background: f.background.trim() || null,
  foreground: f.foreground.trim() || null,
  radius: f.radius || null,
  font: f.font || null,
})

/** The tenant's brand: name, marks, the customer app's theme, where customers order, and which parts of the platform are on. */
export function BrandSettings() {
  const t = useT()
  const brand = useBrand()

  return (
    <Main>
      <PageHeader title={t('brandNav')} />
      {/* Keyed on the version so a save elsewhere re-seeds the form */}
      {brand ? (
        <BrandForm key={String(brand.version)} brand={brand} />
      ) : (
        <Skeleton className='h-96 w-full' />
      )}
    </Main>
  )
}

function BrandForm({ brand }: { brand: Brand }) {
  const t = useT()
  const queryClient = useQueryClient()

  const [name, setName] = useState<LocalizedValue>(toLocalizedValue(brand.name))
  const [color, setColor] = useState(brand.primaryColor ?? '')
  const [theme, setTheme] = useState<ThemeForm>(toThemeForm(brand.theme))
  const [customerUrl, setCustomerUrl] = useState(brand.customerUrl ?? '')
  const [features, setFeatures] = useState<TenantFeatures>(brand.features)
  const [error, setError] = useState<string | null>(null)

  const put = (next: Brand) => queryClient.setQueryData(brandQueryKey(), next)
  const saved = (data: Brand) => {
    put(data)
    toast.success(t('brandSaved'))
  }

  const update = useMutation({
    ...updateTenantMutation(),
    onSuccess: saved,
    onError: (e) => toast.error(problemDetail(e) || t('brandSaveFailed')),
  })
  const uploadImage = useMutation({
    ...uploadTenantImageMutation(),
    onSuccess: saved,
    onError: (e) => toast.error(problemDetail(e) || t('logoRejected')),
  })
  const deleteImage = useMutation({
    ...deleteTenantImageMutation(),
    onSuccess: saved,
    onError: () => toast.error(t('brandSaveFailed')),
  })
  // One slot is busy at a time: the one whose request is in flight
  const busySlot =
    (uploadImage.isPending && uploadImage.variables?.path.slot) ||
    (deleteImage.isPending && deleteImage.variables?.path.slot) ||
    null
  const imageSlot = ({ slot, label }: { slot: ImageSlot; label: TranslationKey }) => (
    <ImageSlotField
      key={slot}
      label={t(label)}
      src={imageOf(brand, slot)?.url ?? null}
      square={isMark(slot)}
      busy={busySlot === slot}
      onUpload={(file) => uploadImage.mutate({ path: { slot }, body: { file } })}
      onRemove={() => deleteImage.mutate({ path: { slot } })}
    />
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.en.trim()) {
      setError(t('nameRequired'))
      return
    }
    setError(null)
    update.mutate({
      body: {
        name: fromLocalizedValue(name),
        primaryColor: color.trim() || null,
        customerUrl: customerUrl.trim() || null,
        features,
        theme: fromThemeForm(theme),
      },
    })
  }

  const draft = { primaryColor: color.trim() || null, theme: fromThemeForm(theme) }

  return (
    <form onSubmit={handleSubmit}>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <Card>
          <CardContent className='space-y-6 pt-6'>
            <LocalizedInput
              id='brand-name'
              label={t('name')}
              value={name}
              onChange={setName}
              error={error ?? undefined}
            />

            <div className='grid gap-6 sm:grid-cols-2'>{MAIN_SLOTS.map(imageSlot)}</div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button type='button' variant='ghost' size='sm' className='-ms-2 group'>
                  <ChevronDown className='me-1 h-4 w-4 transition-transform group-data-[state=open]:rotate-180' />
                  {t('brandVariants')}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='grid gap-6 pt-4 sm:grid-cols-2'>
                {VARIANT_SLOTS.map(imageSlot)}
              </CollapsibleContent>
            </Collapsible>

            <div className='space-y-3'>
              <Label>{t('brandTheme')}</Label>
              <div className='grid gap-3 sm:grid-cols-2'>
                <ColorField
                  id='brand-color'
                  label={t('brandColor')}
                  value={color}
                  onChange={setColor}
                />
                <ColorField
                  id='brand-accent'
                  label={t('accentColor')}
                  value={theme.accent}
                  onChange={(accent) => setTheme({ ...theme, accent })}
                />
                <ColorField
                  id='brand-background'
                  label={t('backgroundColor')}
                  value={theme.background}
                  onChange={(background) => setTheme({ ...theme, background })}
                  fallback='#ffffff'
                />
                <ColorField
                  id='brand-foreground'
                  label={t('textColor')}
                  value={theme.foreground}
                  onChange={(foreground) => setTheme({ ...theme, foreground })}
                />
                <div className='space-y-1.5'>
                  <Label htmlFor='brand-radius' className='text-xs'>
                    {t('cornerRadius')}
                  </Label>
                  <Select
                    value={theme.radius || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, radius: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-radius' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('defaultOption')}</SelectItem>
                      {Object.keys(RADII).map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(RADIUS_LABELS[r])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='brand-font' className='text-xs'>
                    {t('fontFamily')}
                  </Label>
                  <Select
                    value={theme.font || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, font: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-font' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('defaultOption')}</SelectItem>
                      {FONTS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='brand-customer-url'>{t('customerUrl')}</Label>
              <Input
                id='brand-customer-url'
                type='url'
                value={customerUrl}
                onChange={(e) => setCustomerUrl(e.target.value)}
                placeholder={window.location.origin}
                dir='ltr'
              />
            </div>

            <div className='space-y-2'>
              <Label>{t('features')}</Label>
              <div className='divide-y rounded-lg border'>
                {FEATURE_ROWS.map((row) => (
                  <div
                    key={row.key}
                    className='flex items-center justify-between p-3'
                  >
                    <Label htmlFor={`feature-${row.key}`} className='text-sm'>
                      {t(row.label)}
                    </Label>
                    <Switch
                      id={`feature-${row.key}`}
                      checked={features[row.key]}
                      onCheckedChange={(v) =>
                        setFeatures({ ...features, [row.key]: v })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className='flex justify-end'>
              <Button type='submit' disabled={update.isPending}>
                {update.isPending && <Spinner className='me-2' />}
                {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className='lg:sticky lg:top-4 lg:self-start'>
          <Label className='mb-2 block'>{t('preview')}</Label>
          <Preview brand={brand} draft={draft} name={name} />
        </div>
      </div>
    </form>
  )
}

/** One image slot: the picture (or an empty tile), upload, remove. */
function ImageSlotField({
  label,
  src,
  square,
  busy,
  onUpload,
  onRemove,
}: {
  label: string
  src: string | null
  square?: boolean
  busy: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className='space-y-2'>
      <Label className='text-xs'>{label}</Label>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          className={cn(
            'bg-muted hover:bg-muted/80 flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-md border',
            square ? 'w-20' : 'w-40'
          )}
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={t('uploadLogo')}
        >
          {busy ? (
            <Spinner />
          ) : src ? (
            <img src={src} alt='' className='h-full w-full object-contain p-1' />
          ) : (
            <ImagePlus className='text-muted-foreground h-6 w-6' />
          )}
        </button>
        <div className='flex flex-col gap-1'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {t('uploadLogo')}
          </Button>
          {src && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-destructive'
              disabled={busy}
              onClick={onRemove}
            >
              <X className='me-1 h-3.5 w-3.5' />
              {t('removeLogo')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
  fallback = DEFAULT_COLOR,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  fallback?: string
}) {
  const t = useT()
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={id} className='text-xs'>
        {label}
      </Label>
      <div className='flex items-center gap-2'>
        <input
          id={id}
          type='color'
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className='h-9 w-11 cursor-pointer rounded-md border bg-transparent p-1'
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('defaultOption')}
          className='font-mono'
          dir='ltr'
        />
        {value && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-8 shrink-0'
            aria-label={t('defaultOption')}
            onClick={() => onChange('')}
          >
            <X className='h-3.5 w-3.5' />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * The customer app's home, in miniature, painted with the draft tokens: the
 * same CSS variables the app reads, set inline on this box, so what is on
 * the right is what customers get once saved.
 */
function Preview({
  brand,
  draft,
  name,
}: {
  brand: Brand
  draft: { primaryColor: string | null; theme: TenantThemeDto }
  name: LocalizedValue
}) {
  const t = useT()
  const currency = useCurrencyLabel()
  const language = useLanguage((s) => s.language)
  const tokens = brandTokens(draft)
  useEffect(() => ensureFontLoaded(tokens.font), [tokens.font])
  const wordmark = wordmarkFor(brand, language, 'light')

  const displayName =
    (language === 'ar' ? name.ar : name.en) || name.en || name.ar || ''
  const items = [
    { name: language === 'ar' ? 'لاتيه' : 'Latte', price: 65 },
    { name: language === 'ar' ? 'كرواسون' : 'Croissant', price: 45 },
  ]

  return (
    <div
      style={tokens.light as React.CSSProperties}
      className='bg-background text-foreground overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center gap-2 border-b px-4 py-3'>
        {wordmark ? (
          <img
            src={wordmark.url}
            alt=''
            style={{
              aspectRatio: `${wordmark.width} / ${wordmark.height}`,
            }}
            className='h-6 w-auto max-w-[60%] object-contain'
          />
        ) : (
          <>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt='' className='size-6 object-contain' />
            ) : (
              <span className='bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs font-semibold'>
                {displayName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className='truncate font-semibold'>{displayName}</span>
          </>
        )}
      </div>
      <div className='space-y-3 p-4'>
        <div className='flex gap-2'>
          <span className='bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium'>
            {t('previewPopular')}
          </span>
          <span className='bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-medium'>
            {t('menuItems')}
          </span>
        </div>
        {items.map((item) => (
          <div
            key={item.name}
            className='bg-card text-card-foreground flex items-center justify-between rounded-lg border p-3'
          >
            <div>
              <div className='text-sm font-medium'>{item.name}</div>
              <div className='text-muted-foreground text-xs'>
                {item.price} {currency}
              </div>
            </div>
            <span className='bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium'>
              {t('previewAdd')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
