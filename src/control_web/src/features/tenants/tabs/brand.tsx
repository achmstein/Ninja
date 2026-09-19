import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import type { BrandDto, BrandFeatures, TenantDetail } from '@/api/control'
import {
  deleteTenantBrandImageMutation,
  getTenantBrandOptions,
  getTenantBrandQueryKey,
  updateTenantBrandMutation,
  uploadTenantBrandImageMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { ColorField } from '@/components/brand/color-field'
import { ImageSlotGrid, SLOT_LABELS } from '@/components/brand/image-slots'
import { LivePreview } from '@/components/brand/live-preview'
import { PhonePreview, PreviewToggles, usePreviewState, type PreviewDraft } from '@/components/brand/phone-preview'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
} from '@/components/localized-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { FONTS, RADII } from '@/lib/brand-theme'
import { useT, type TranslationKey } from '@/lib/i18n'
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
  { key: 'rooms', label: 'featureRooms' },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
]

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

const imagesOf = (brand: BrandDto): BrandImages => ({
  logoUrl: brand.logoUrl,
  logoDarkUrl: brand.logoDarkUrl,
  wordmarks: brand.wordmarks,
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
      {/* The phone shows the draft while it differs from what is saved, and the real app once it is saved */}
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
        {draft ? (
          <PhonePreview draft={draft} language={preview.language} scheme={preview.scheme} />
        ) : (
          <LivePreview
            customerUrl={withScheme(data.customerUrl ?? tenant.hosts.customer)}
            version={data.version}
            language={preview.language}
            scheme={preview.scheme}
          />
        )}
      </div>
    </div>
  )
}

function BrandForm({ slug, brand, onDraft }: { slug: string; brand: BrandDto; onDraft: (draft: PreviewDraft | null) => void }) {
  const t = useT()
  const queryClient = useQueryClient()

  const [name, setName] = useState(toLocalizedValue(brand.name))
  const [primary, setPrimary] = useState(brand.primaryColor ?? '')
  const [accent, setAccent] = useState(brand.theme.accent ?? '')
  const [background, setBackground] = useState(brand.theme.background ?? '')
  const [foreground, setForeground] = useState(brand.theme.foreground ?? '')
  const [radius, setRadius] = useState(brand.theme.radius ?? DEFAULT)
  const [font, setFont] = useState(brand.theme.font ?? DEFAULT)
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

  const themeOf = (accent: string, background: string, foreground: string, radius: string, font: string) => ({
    accent: orNull(accent),
    background: orNull(background),
    foreground: orNull(foreground),
    radius: radius === DEFAULT ? null : radius,
    font: font === DEFAULT ? null : font,
  })
  const draft = useMemo<PreviewDraft>(
    () => ({
      name: { en: name.en, ar: name.ar },
      primaryColor: orNull(primary),
      theme: themeOf(accent, background, foreground, radius, font),
      images: imagesOf(brand),
      currency: brand.locale.currency,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, primary, accent, background, foreground, radius, font, brand]
  )
  const saved = useMemo(
    () => ({
      name: toLocalizedValue(brand.name),
      primaryColor: orNull(brand.primaryColor ?? ''),
      theme: themeOf(brand.theme.accent ?? '', brand.theme.background ?? '', brand.theme.foreground ?? '', brand.theme.radius ?? DEFAULT, brand.theme.font ?? DEFAULT),
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
    [primary, accent, background, foreground].every(colorOk) &&
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
        theme: {
          accent: orNull(accent),
          background: orNull(background),
          foreground: orNull(foreground),
          radius: radius === DEFAULT ? null : radius,
          font: font === DEFAULT ? null : font,
        },
        locale: brand.locale,
      },
    })
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className='flex flex-col gap-5'>
          <LocalizedInput label={t('name')} value={name} onChange={setName} />
          <ColorField
            id='brand-primary'
            label={t('brandColor')}
            value={primary}
            onChange={setPrimary}
            swatchesFrom={brand.logoUrl}
            eyedropper
          />
          <div className='grid gap-4 sm:grid-cols-3'>
            <ColorField id='brand-accent' label={t('accentColor')} value={accent} onChange={setAccent} eyedropper />
            <ColorField
              id='brand-background'
              label={t('backgroundColor')}
              value={background}
              onChange={setBackground}
              fallback='#ffffff'
              eyedropper
            />
            <ColorField id='brand-foreground' label={t('textColor')} value={foreground} onChange={setForeground} eyedropper />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-2'>
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
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='brand-font' className='text-xs'>{t('fontFamily')}</Label>
              <Select value={font} onValueChange={setFont}>
                <SelectTrigger id='brand-font' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>{t('defaultOption')}</SelectItem>
                  {FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
              {FEATURES.map(({ key, label }) => (
                <div key={key} className='flex items-center justify-between gap-4 px-3 py-2'>
                  <Label htmlFor={`feature-${key}`} className='font-normal'>
                    {t(label)}
                  </Label>
                  <Switch
                    id={`feature-${key}`}
                    checked={features[key]}
                    onCheckedChange={(v) => setFeatures((f) => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
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
