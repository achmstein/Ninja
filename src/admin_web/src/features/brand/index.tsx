import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ImagePlus, X } from 'lucide-react'
import { AxiosError } from 'axios'
import { type TenantFeatures, type TenantThemeDto } from '@/api/branch'
import {
  deleteTenantImageMutation,
  updateTenantMutation,
  uploadTenantImageMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { brandQueryKey, useBrand, useCustomerOrigin, type Brand } from '@/lib/brand'
import { imageOf, isMark, type ImageSlot } from '@/lib/brand-slots'
import { ARABIC_FONTS, LATIN_FONTS, RADII } from '@/lib/brand-theme'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
import { ContrastNotice } from '@/components/brand/contrast-notice'
import { LivePreview } from '@/components/brand/live-preview'
import { PreviewToggles, usePreviewState, type PreviewDraft } from '@/components/brand/phone-preview'

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
  surface: string
  radius: string
  fontLatin: string
  fontArabic: string
  darkPrimary: string
  darkAccent: string
  darkSurface: string
}

const toThemeForm = (t: TenantThemeDto): ThemeForm => ({
  accent: t.accent ?? '',
  surface: t.surface ?? '',
  radius: t.radius ?? '',
  fontLatin: t.fontLatin ?? '',
  fontArabic: t.fontArabic ?? '',
  darkPrimary: t.dark?.primary ?? '',
  darkAccent: t.dark?.accent ?? '',
  darkSurface: t.dark?.surface ?? '',
})

const orNull = (v: string) => v.trim().toLowerCase() || null

const fromThemeForm = (f: ThemeForm): TenantThemeDto => {
  const dark = { primary: orNull(f.darkPrimary), accent: orNull(f.darkAccent), surface: orNull(f.darkSurface) }
  return {
    accent: orNull(f.accent),
    surface: orNull(f.surface),
    radius: f.radius || null,
    fontLatin: f.fontLatin || null,
    fontArabic: f.fontArabic || null,
    dark: dark.primary || dark.accent || dark.surface ? dark : null,
  }
}

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

  // The real app in the phone, painted with the draft while it differs from
  // what is saved: what you are changing, on what customers actually use
  const preview = usePreviewState()
  const customerOrigin = useCustomerOrigin()
  const draft = useMemo<PreviewDraft>(
    () => ({
      name: { en: name.en, ar: name.ar },
      primaryColor: color.trim() || null,
      theme: fromThemeForm(theme),
      brand,
      currency: brand.locale.currency,
    }),
    [name, color, theme, brand]
  )
  const savedDraft = useMemo(
    () => ({
      name: toLocalizedValue(brand.name),
      primaryColor: brand.primaryColor ?? null,
      theme: fromThemeForm(toThemeForm(brand.theme)),
    }),
    [brand]
  )
  const dirty =
    JSON.stringify({ name: draft.name, primaryColor: draft.primaryColor, theme: draft.theme }) !==
    JSON.stringify(savedDraft)

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
                  id='brand-surface'
                  label={t('surfaceColor')}
                  value={theme.surface}
                  onChange={(surface) => setTheme({ ...theme, surface })}
                  fallback='#ffffff'
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
                <FontSelect
                  id='brand-font-latin'
                  label={t('fontLatin')}
                  value={theme.fontLatin}
                  onChange={(fontLatin) => setTheme({ ...theme, fontLatin })}
                  fonts={LATIN_FONTS}
                />
                <FontSelect
                  id='brand-font-arabic'
                  label={t('fontArabic')}
                  value={theme.fontArabic}
                  onChange={(fontArabic) => setTheme({ ...theme, fontArabic })}
                  fonts={ARABIC_FONTS}
                />
              </div>
              <Collapsible defaultOpen={Boolean(theme.darkPrimary || theme.darkAccent || theme.darkSurface)}>
                <CollapsibleTrigger asChild>
                  <Button type='button' variant='ghost' size='sm' className='-ms-2 group'>
                    <ChevronDown className='me-1 h-4 w-4 transition-transform group-data-[state=open]:rotate-180' />
                    {t('darkScheme')}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='grid gap-3 pt-3 sm:grid-cols-3'>
                  <ColorField
                    id='brand-dark-primary'
                    label={t('brandColor')}
                    value={theme.darkPrimary}
                    onChange={(darkPrimary) => setTheme({ ...theme, darkPrimary })}
                    placeholder={t('derived')}
                  />
                  <ColorField
                    id='brand-dark-accent'
                    label={t('accentColor')}
                    value={theme.darkAccent}
                    onChange={(darkAccent) => setTheme({ ...theme, darkAccent })}
                    placeholder={t('derived')}
                  />
                  <ColorField
                    id='brand-dark-surface'
                    label={t('surfaceColor')}
                    value={theme.darkSurface}
                    onChange={(darkSurface) => setTheme({ ...theme, darkSurface })}
                    fallback='#111111'
                    placeholder={t('derived')}
                  />
                </CollapsibleContent>
              </Collapsible>
              <ContrastNotice input={{ primaryColor: orNull(color), theme: fromThemeForm(theme) }} />
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

        <div className='flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:self-start'>
          <div className='flex items-center gap-2'>
            <PreviewToggles
              language={preview.language}
              scheme={preview.scheme}
              onLanguage={preview.setLanguage}
              onScheme={preview.setScheme}
            />
            <Badge variant={dirty ? 'secondary' : 'outline'}>{t(dirty ? 'draft' : 'previewLive')}</Badge>
          </div>
          <LivePreview
            customerUrl={customerOrigin}
            version={brand.version}
            language={preview.language}
            scheme={preview.scheme}
            draft={dirty ? { primaryColor: draft.primaryColor, theme: draft.theme } : null}
          />
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

function FontSelect({
  id,
  label,
  value,
  onChange,
  fonts,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  fonts: readonly string[]
}) {
  const t = useT()
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={id} className='text-xs'>
        {label}
      </Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('defaultOption')}</SelectItem>
          {fonts.map((f) => (
            <SelectItem key={f} value={f} style={{ fontFamily: `'${f}'` }}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
  fallback = DEFAULT_COLOR,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  fallback?: string
  /** What the empty field says; the default is the platform's own colour */
  placeholder?: string
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
          placeholder={placeholder ?? t('defaultOption')}
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
