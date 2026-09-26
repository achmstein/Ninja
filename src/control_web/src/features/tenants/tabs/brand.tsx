import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Info } from 'lucide-react'
import type { BrandDto, BrandFeatures, TenantDetail } from '@/api/control'
import {
  deleteTenantBrandImageMutation,
  getTenantBrandOptions,
  getTenantBrandQueryKey,
  updateTenantBrandMutation,
  uploadTenantBrandImageMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { ColorField } from '@/components/brand/color-field'
import { ContrastNotice } from '@/components/brand/contrast-notice'
import { ImageSlotGrid, SLOT_LABELS } from '@/components/brand/image-slots'
import { LivePreview } from '@/components/brand/live-preview'
import { PhonePreview, PreviewToggles, usePreviewState, type PreviewDraft } from '@/components/brand/phone-preview'
import { StylePicker } from '@/components/brand/style-picker'
import { FontOptions } from '@/components/brand/font-options'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
} from '@/components/localized-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import {
  imageOf,
  imagesFromUrls,
  VARIANT_SLOTS,
  type BrandImages,
  type ImageSlot,
} from '@/lib/brand-slots'
import { ARABIC_FONT_CATALOG, ARABIC_FONTS, ensureFontPreviews, knownFont, LATIN_FONT_CATALOG, LATIN_FONTS, type BrandFont } from '@/lib/brand-fonts'
import { RADII, type BrandThemeInput } from '@/lib/brand-theme'
import { useT, type TranslationKey } from '@/lib/i18n'
import { fromLayoutForm, toLayoutForm, type LayoutForm } from '@/lib/layout-form'
import { problemDetail } from '@/lib/problem'
import { isHexColor, tenantStatus } from '@/lib/tenant'
import { toast } from '@/lib/toast'

const DEFAULT = '__default__'

const RADIUS_LABELS: Record<string, TranslationKey> = {
  none: 'radiusNone',
  sm: 'radiusSm',
  md: 'radiusMd',
  lg: 'radiusLg',
  xl: 'radiusXl',
}

const FEATURES: { key: keyof BrandFeatures; label: TranslationKey }[] = [
  { key: 'reservations', label: 'featureReservations' },
  { key: 'timeBilling', label: 'featureTimeBilling' },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
  { key: 'onlinePayments', label: 'featureOnlinePayments' },
]

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

const imagesOf = (brand: BrandDto): BrandImages => ({
  logoUrl: brand.logoUrl,
  logoDarkUrl: brand.logoDarkUrl,
  wordmarks: brand.wordmarks,
  cover: brand.cover?.url ?? null,
})

/**
 * The café's brand as its running stack holds it: name, colours, theme,
 * features and images, next to the real customer app in a phone. Off a
 * running stack there is nothing to edit, so a mock shows what is on record.
 */
export function BrandTab({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const preview = usePreviewState()
  // What the form holds while it differs from the saved brand; null once they match
  const [draft, setDraft] = useState<PreviewDraft | null>(null)
  const running = tenantStatus(tenant.status) === 'Running'

  const brand = useQuery({
    ...getTenantBrandOptions({ path: { slug: tenant.slug } }),
    enabled: running,
    retry: false,
  })

  if (!running || brand.isError) {
    return (
      <div className='flex flex-col gap-6 lg:flex-row lg:items-start'>
        <Alert className='flex-1'>
          <Info />
          <AlertDescription>
            {(brand.isError && problemDetail(brand.error)) || t('brandNotRunning')}
          </AlertDescription>
        </Alert>
        <div className='flex flex-col items-center gap-3'>
          <PreviewToggles
            language={preview.language}
            scheme={preview.scheme}
            onLanguage={preview.setLanguage}
            onScheme={preview.setScheme}
          />
          <PhonePreview
            draft={{
              name: { en: tenant.nameEn, ar: tenant.nameAr ?? '' },
              primaryColor: tenant.primaryColor,
              theme: null,
              images: imagesFromUrls({}),
              currency: tenant.locale.currency,
            }}
            language={preview.language}
            scheme={preview.scheme}
          />
        </div>
      </div>
    )
  }

  if (!brand.data) {
    return (
      <div className='grid gap-6 xl:grid-cols-[1fr_20rem]'>
        <Skeleton className='h-96 w-full' />
        <Skeleton className='mx-auto h-[36rem] w-72' />
      </div>
    )
  }

  const data = brand.data
  return (
    <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]'>
      <div className='flex flex-col gap-6'>
        <BrandForm key={String(data.version)} slug={tenant.slug} brand={data} onDraft={setDraft} />
        <BrandImagesCard slug={tenant.slug} brand={data} />
      </div>
      {/* The real app in the phone, painted with the draft while it differs from what is saved */}
      <div className='flex flex-col items-center gap-3 xl:sticky xl:top-4 xl:self-start'>
        <div className='flex items-center gap-2'>
          <PreviewToggles
            language={preview.language}
            scheme={preview.scheme}
            onLanguage={preview.setLanguage}
            onScheme={preview.setScheme}
          />
          <Badge variant={draft ? 'secondary' : 'outline'}>{t(draft ? 'previewDraft' : 'previewLive')}</Badge>
        </div>
        <LivePreview
          customerUrl={withScheme(data.customerUrl ?? tenant.hosts.customer)}
          version={data.version}
          language={preview.language}
          scheme={preview.scheme}
          draft={draft && { primaryColor: draft.primaryColor, theme: draft.theme }}
        />
      </div>
    </div>
  )
}

function BrandForm({ slug, brand, onDraft }: { slug: string; brand: BrandDto; onDraft: (draft: PreviewDraft | null) => void }) {
  const t = useT()
  const queryClient = useQueryClient()

  const [name, setName] = useState(toLocalizedValue(brand.name))
  // Null until a style is picked: a café that never chose stays on classic without saying so
  const [style, setStyle] = useState<string | null>(brand.theme.style ?? null)
  const [layout, setLayout] = useState<LayoutForm>(toLayoutForm(brand.theme.layout))
  const [primary, setPrimary] = useState(brand.primaryColor ?? '')
  const [accent, setAccent] = useState(brand.theme.accent ?? '')
  const [surface, setSurface] = useState(brand.theme.surface ?? '')
  const [radius, setRadius] = useState(brand.theme.radius ?? DEFAULT)
  const [headerSize, setHeaderSize] = useState(brand.theme.headerSize ?? DEFAULT)
  const [fontLatin, setFontLatin] = useState(knownFont(brand.theme.fontLatin, LATIN_FONTS) ?? DEFAULT)
  const [fontArabic, setFontArabic] = useState(knownFont(brand.theme.fontArabic, ARABIC_FONTS) ?? DEFAULT)
  const [darkPrimary, setDarkPrimary] = useState(brand.theme.dark?.primary ?? '')
  const [darkAccent, setDarkAccent] = useState(brand.theme.dark?.accent ?? '')
  const [darkSurface, setDarkSurface] = useState(brand.theme.dark?.surface ?? '')
  const [customerUrl, setCustomerUrl] = useState(brand.customerUrl ?? '')
  const [features, setFeatures] = useState<BrandFeatures>({ ...brand.features })

  const orNull = (v: string) => (v.trim() ? v.trim().toLowerCase() : null)

  const save = useMutation({
    ...updateTenantBrandMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getTenantBrandQueryKey({ path: { slug } }), saved)
      toast.success(t('brandSaved'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('brandSaveFailed')),
  })

  const themeOf = (f: { style: string | null; layout: LayoutForm; accent: string; surface: string; radius: string; headerSize: string; fontLatin: string; fontArabic: string; darkPrimary: string; darkAccent: string; darkSurface: string }) => {
    const dark = { primary: orNull(f.darkPrimary), accent: orNull(f.darkAccent), surface: orNull(f.darkSurface) }
    return {
      accent: orNull(f.accent),
      surface: orNull(f.surface),
      radius: f.radius === DEFAULT ? null : f.radius,
      headerSize: f.headerSize === DEFAULT ? null : f.headerSize,
      fontLatin: f.fontLatin === DEFAULT ? null : f.fontLatin,
      fontArabic: f.fontArabic === DEFAULT ? null : f.fontArabic,
      dark: dark.primary || dark.accent || dark.surface ? dark : null,
      style: f.style,
      layout: fromLayoutForm(f.layout),
    }
  }
  const theme = useMemo(
    () => themeOf({ style, layout, accent, surface, radius, headerSize, fontLatin, fontArabic, darkPrimary, darkAccent, darkSurface }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, layout, accent, surface, radius, headerSize, fontLatin, fontArabic, darkPrimary, darkAccent, darkSurface]
  )
  const draft = useMemo<PreviewDraft>(
    () => ({
      name: { en: name.en, ar: name.ar },
      primaryColor: orNull(primary),
      theme,
      images: imagesOf(brand),
      currency: brand.locale.currency,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, primary, theme, brand]
  )
  const saved = useMemo(
    () => ({
      name: toLocalizedValue(brand.name),
      primaryColor: orNull(brand.primaryColor ?? ''),
      theme: themeOf({
        style: brand.theme.style ?? null,
        layout: toLayoutForm(brand.theme.layout),
        accent: brand.theme.accent ?? '',
        surface: brand.theme.surface ?? '',
        radius: brand.theme.radius ?? DEFAULT,
        headerSize: brand.theme.headerSize ?? DEFAULT,
        fontLatin: knownFont(brand.theme.fontLatin, LATIN_FONTS) ?? DEFAULT,
        fontArabic: knownFont(brand.theme.fontArabic, ARABIC_FONTS) ?? DEFAULT,
        darkPrimary: brand.theme.dark?.primary ?? '',
        darkAccent: brand.theme.dark?.accent ?? '',
        darkSurface: brand.theme.dark?.surface ?? '',
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brand]
  )
  const dirty = JSON.stringify({ name: draft.name, primaryColor: draft.primaryColor, theme: draft.theme }) !== JSON.stringify(saved)
  useEffect(() => onDraft(dirty ? draft : null), [dirty, draft, onDraft])
  useEffect(() => () => onDraft(null), [onDraft])

  const colorOk = (v: string) => v === '' || isHexColor(v)
  const canSubmit =
    name.en.trim().length > 0 &&
    [primary, accent, surface, darkPrimary, darkAccent, darkSurface].every(colorOk) &&
    !save.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    save.mutate({
      path: { slug },
      body: {
        name: fromLocalizedValue(name),
        primaryColor: orNull(primary),
        customerUrl: customerUrl.trim() || null,
        features,
        // The starting light or dark and the locale are the record's; they go back as the café has them
        theme: { ...theme, mode: brand.theme.mode ?? null },
        locale: brand.locale,
      },
    })
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className='flex flex-col gap-5'>
          <LocalizedInput label={t('name')} value={name} onChange={setName} />
          <StylePicker style={style} layout={layout} onStyleChange={setStyle} onLayoutChange={setLayout} />
          <ColorField
            id='brand-primary'
            label={t('brandColor')}
            value={primary}
            onChange={setPrimary}
            swatchesFrom={brand.logoUrl}
            eyedropper
            hint={t('brandColorHint')}
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <ColorField id='brand-accent' label={t('accentColor')} value={accent} onChange={setAccent} eyedropper hint={t('secondaryColorHint')} />
            <ColorField id='brand-surface' label={t('surfaceColor')} value={surface} onChange={setSurface} fallback='#ffffff' eyedropper hint={t('surfaceColorHint')} />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid content-start gap-2'>
              <Label htmlFor='brand-radius' className='text-xs'>{t('cornerRadius')}</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger id='brand-radius' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>{t('defaultOption')}</SelectItem>
                  {Object.keys(RADII).map((key) => (
                    <SelectItem key={key} value={key}>
                      {RADIUS_LABELS[key] ? t(RADIUS_LABELS[key]) : key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>{t('cornerRadiusHint')}</p>
            </div>
            <div className='grid content-start gap-2'>
              <Label htmlFor='brand-header' className='text-xs'>{t('headerSize')}</Label>
              <Select value={headerSize} onValueChange={setHeaderSize}>
                <SelectTrigger id='brand-header' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>{t('defaultOption')}</SelectItem>
                  <SelectItem value='sm'>{t('headerSm')}</SelectItem>
                  <SelectItem value='md'>{t('headerMd')}</SelectItem>
                  <SelectItem value='lg'>{t('headerLg')}</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>{t('headerSizeHint')}</p>
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FontSelect id='brand-font-latin' label={t('fontLatin')} value={fontLatin} onChange={setFontLatin} fonts={LATIN_FONT_CATALOG} />
            <FontSelect id='brand-font-arabic' label={t('fontArabic')} value={fontArabic} onChange={setFontArabic} fonts={ARABIC_FONT_CATALOG} />
          </div>
          <Collapsible defaultOpen={Boolean(darkPrimary || darkAccent || darkSurface)}>
            <CollapsibleTrigger asChild>
              <Button type='button' variant='ghost' size='sm' className='group -ms-2'>
                <ChevronDown className='transition-transform group-data-[state=open]:rotate-180' />
                {t('darkScheme')}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='grid gap-4 pt-3 sm:grid-cols-3'>
              <ColorField id='brand-dark-primary' label={t('brandColor')} value={darkPrimary} onChange={setDarkPrimary} placeholder={t('derived')} eyedropper />
              <ColorField id='brand-dark-accent' label={t('accentColor')} value={darkAccent} onChange={setDarkAccent} placeholder={t('derived')} eyedropper />
              <ColorField id='brand-dark-surface' label={t('surfaceColor')} value={darkSurface} onChange={setDarkSurface} fallback='#111111' placeholder={t('derived')} eyedropper />
            </CollapsibleContent>
          </Collapsible>
          <ContrastNotice input={{ primaryColor: orNull(primary), theme } satisfies BrandThemeInput} />
          <div className='grid gap-2'>
            <Label htmlFor='brand-url' className='text-xs'>{t('customerUrl')}</Label>
            <Input
              id='brand-url'
              dir='ltr'
              type='url'
              placeholder='https://'
              value={customerUrl}
              onChange={(e) => setCustomerUrl(e.target.value)}
            />
          </div>
          <div className='grid gap-2'>
            <Label className='text-xs'>{t('features')}</Label>
            <div className='divide-y rounded-lg border'>
              {FEATURES.map(({ key, label }) => {
                // A stack older than plans answers without entitlements: everything is allowed there
                const entitled = brand.entitlements?.[key] ?? true
                return (
                  <div key={key} className='flex items-center justify-between gap-4 px-3 py-2'>
                    <Label htmlFor={`feature-${key}`} className='flex items-center gap-2 font-normal'>
                      {t(label)}
                      {!entitled && <Badge variant='outline'>{t('notInPlan')}</Badge>}
                    </Label>
                    <Switch
                      id={`feature-${key}`}
                      checked={entitled && features[key]}
                      disabled={!entitled}
                      onCheckedChange={(v) => setFeatures((f) => ({ ...f, [key]: v }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className='flex justify-end'>
            <Button type='submit' disabled={!canSubmit}>
              {save.isPending && <Spinner />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function FontSelect({ id, label, value, onChange, fonts }: { id: string; label: string; value: string; onChange: (v: string) => void; fonts: readonly BrandFont[] }) {
  const t = useT()
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id} className='text-xs'>{label}</Label>
      <Select value={value} onValueChange={onChange} onOpenChange={(open) => open && ensureFontPreviews(fonts)}>
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{t('defaultOption')}</SelectItem>
          <FontOptions catalog={fonts} displayLabel={t('fontDisplayGroup')} />
        </SelectContent>
      </Select>
    </div>
  )
}

function BrandImagesCard({ slug, brand }: { slug: string; brand: BrandDto }) {
  const t = useT()
  const queryClient = useQueryClient()
  const images = imagesOf(brand)
  const key = getTenantBrandQueryKey({ path: { slug } })

  const upload = useMutation({
    ...uploadTenantBrandImageMutation(),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
    onError: (e, vars) =>
      toast.error(
        problemDetail(e) ||
          t('imageUploadFailed', { slot: t(SLOT_LABELS[vars.path.slot as ImageSlot]) })
      ),
  })
  const remove = useMutation({
    ...deleteTenantBrandImageMutation(),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const busySlot = upload.isPending
    ? (upload.variables?.path.slot as ImageSlot)
    : remove.isPending
      ? (remove.variables?.path.slot as ImageSlot)
      : null

  return (
    <Card>
      <CardContent>
        <ImageSlotGrid
          srcOf={(slot) => imageOf(images, slot)}
          busySlot={busySlot}
          onUpload={(slot, file) => upload.mutate({ path: { slug, slot }, body: { file } })}
          onRemove={(slot) => remove.mutate({ path: { slug, slot } })}
          defaultOpen={VARIANT_SLOTS.some((slot) => imageOf(images, slot) !== null)}
        />
      </CardContent>
    </Card>
  )
}
