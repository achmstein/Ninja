import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Lock, X } from 'lucide-react'
import { type TenantFeatures, type TenantThemeDto } from '@/api/tenant'
import {
  deleteTenantImageMutation,
  updateTenantMutation,
  uploadTenantImageMutation,
} from '@/api/tenant/@tanstack/react-query.gen'
import {
  brandQueryKey,
  defaultCustomerOrigin,
  useBrand,
  useCustomerOrigin,
  useIsCloudKitchen,
  type Brand,
} from '@/lib/brand'
import {
  ARABIC_FONT_CATALOG,
  ARABIC_FONTS,
  ensureFontPreviews,
  knownFont,
  LATIN_FONT_CATALOG,
  LATIN_FONTS,
  type BrandFont,
} from '@/lib/brand-fonts'
import { imageOf, isMark, isPhoto, type ImageSlot } from '@/lib/brand-slots'
import { RADII } from '@/lib/brand-theme'
import {
  contentLanguagesOf,
  type ContentLanguages,
} from '@/lib/content-languages'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ContrastNotice } from '@/components/brand/contrast-notice'
import { FontOptions } from '@/components/brand/font-options'
import { LivePreview } from '@/components/brand/live-preview'
import { useLogoCleanup } from '@/components/brand/logo-cleanup'
import {
  PreviewToggles,
  usePreviewState,
  type PreviewDraft,
} from '@/components/brand/phone-preview'
import { Field, FieldGrid, SwitchRow } from '@/components/field'
import { ImageField } from '@/components/image-field'
import { SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import {
  LocalizedInput,
  fromLocalizedValue,
  isBlank,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { PageHeader } from '@/components/page-header'

const FEATURE_ROWS: {
  key: keyof TenantFeatures
  label: TranslationKey
  needsPlaces?: boolean
  addon?: boolean
}[] = [
  // Both hang off a place: a cloud kitchen, with none, is not offered them
  { key: 'reservations', label: 'featureReservations', needsPlaces: true },
  { key: 'timeBilling', label: 'featureTimeBilling', needsPlaces: true },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
  // An add-on on every plan: not offered at all until it is bought
  { key: 'onlinePayments', label: 'featureOnlinePayments', addon: true },
  // Delivery and pickup orders paid before the branch sees them; with online payments only
  { key: 'payAhead', label: 'featurePayAhead', addon: true },
  { key: 'delivery', label: 'featureDelivery', addon: true },
  // Every AI helper and the owner's assistant: in Pro, bought on top of the others
  { key: 'ai', label: 'featureAi' },
]

/** The two slots every business fills and the cover photo, then the four variants behind a disclosure. */
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
  headerSize: string
  mode: string
  fontLatin: string
  fontArabic: string
  darkPrimary: string
  darkAccent: string
  darkSurface: string
  /** The dock's colour: '' a deep shade of the brand colour, 'neutral' black */
  slab: string
  /** How the menu lists the dishes: '' the swiped cards; 'row' a list, 'card' a photo grid, 'compact' text rows, 'hero' magazine cards */
  menuItem: string
  /** How the Book tab lists the places: '' a big card each, 'list' a slim row each, 'grid' two small tiles a row */
  places: string
}

const toThemeForm = (t: TenantThemeDto): ThemeForm => ({
  accent: t.accent ?? '',
  surface: t.surface ?? '',
  radius: t.radius ?? '',
  headerSize: t.headerSize ?? '',
  mode: t.mode ?? '',
  // A family the catalog no longer has shows (and saves) as the default
  fontLatin: knownFont(t.fontLatin, LATIN_FONTS) ?? '',
  fontArabic: knownFont(t.fontArabic, ARABIC_FONTS) ?? '',
  darkPrimary: t.dark?.primary ?? '',
  darkAccent: t.dark?.accent ?? '',
  darkSurface: t.dark?.surface ?? '',
  slab: t.slab === 'neutral' ? 'neutral' : '',
  // Rows are what a business gets when it chooses nothing, so a saved 'row' reads as that
  menuItem: ['card', 'compact', 'hero', 'deck', 'tiles'].includes(
    t.layout?.menuItem ?? ''
  )
    ? (t.layout?.menuItem ?? '')
    : '',
  // Cards are what a business gets when it chooses nothing, so a saved 'cards' reads as that
  places: ['list', 'grid'].includes(t.layout?.places ?? '')
    ? (t.layout?.places ?? '')
    : '',
})

const orNull = (v: string) => v.trim().toLowerCase() || null

const fromThemeForm = (f: ThemeForm): TenantThemeDto => {
  const dark = {
    primary: orNull(f.darkPrimary),
    accent: orNull(f.darkAccent),
    surface: orNull(f.darkSurface),
  }
  return {
    accent: orNull(f.accent),
    surface: orNull(f.surface),
    radius: f.radius || null,
    headerSize: f.headerSize || null,
    mode: f.mode || null,
    fontLatin: f.fontLatin || null,
    fontArabic: f.fontArabic || null,
    dark: dark.primary || dark.accent || dark.surface ? dark : null,
    // Ninja is the only style for now, worn whole
    style: 'ninja',
    slab: f.slab || null,
    // The parts the business picks for now: the menu's style and the Book tab's
    layout:
      f.menuItem || f.places
        ? {
            menuItem: f.menuItem || null,
            categories: null,
            header: null,
            buttons: null,
            surface: null,
            density: null,
            places: f.places || null,
          }
        : null,
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

  const [arabicStyle, setArabicStyle] = useState<string>(
    brand.locale.arabicStyle ?? 'egyptian'
  )
  const [contentLanguages, setContentLanguages] = useState<ContentLanguages>(
    contentLanguagesOf(brand.locale.contentLanguages)
  )
  const [name, setName] = useState<LocalizedValue>(toLocalizedValue(brand.name))
  const [color, setColor] = useState(brand.primaryColor ?? '')
  const [theme, setTheme] = useState<ThemeForm>(toThemeForm(brand.theme))
  const [customerUrl, setCustomerUrl] = useState(brand.customerUrl ?? '')
  const [features, setFeatures] = useState<TenantFeatures>(brand.features)
  const cloudKitchen = useIsCloudKitchen()
  const [guestOrdersAnywhere, setGuestOrdersAnywhere] = useState(
    brand.guestOrdersAnywhere ?? false
  )
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
  // One after the other, a logo and the dark one made from it: each answer is the whole brand, so the last
  // to land must be the last saved
  const logoCleanup = useLogoCleanup({
    onUse: async (picked) => {
      for (const { slot, file } of picked) {
        try {
          await uploadImage.mutateAsync({ path: { slot }, body: { file } })
        } catch {
          return // said by the mutation's own onError
        }
      }
    },
    hasImage: (slot) => imageOf(brand, slot) !== null,
  })
  const busySlot =
    (uploadImage.isPending && uploadImage.variables?.path.slot) ||
    (deleteImage.isPending && deleteImage.variables?.path.slot) ||
    logoCleanup.busySlot
  // A mark is square, a wordmark wide, the cover a cropped photo; an SVG is
  // drawn as a PNG before it is uploaded, and a photo is never a vector
  const imageSlot = ({
    slot,
    label,
    hint,
  }: {
    slot: ImageSlot
    label: TranslationKey
    hint?: TranslationKey
  }) => (
    <ImageField
      key={slot}
      label={t(label)}
      hint={hint && t(hint)}
      src={imageOf(brand, slot)?.url ?? null}
      shape={isPhoto(slot) ? 'photo' : isMark(slot) ? 'square' : 'wide'}
      contain={!isPhoto(slot)}
      accept={
        isPhoto(slot)
          ? undefined
          : 'image/png,image/jpeg,image/webp,image/svg+xml'
      }
      busy={busySlot === slot}
      onFile={(file) => logoCleanup.pick(slot, file)}
      onRemove={() => deleteImage.mutate({ path: { slot } })}
      removeLabel={t('removeLogo')}
    />
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlank(name)) {
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
        guestOrdersAnywhere,
        theme: fromThemeForm(theme),
        locale: { ...brand.locale, arabicStyle, contentLanguages },
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
    JSON.stringify({
      name: draft.name,
      primaryColor: draft.primaryColor,
      theme: draft.theme,
    }) !== JSON.stringify(savedDraft)

  return (
    <form onSubmit={handleSubmit}>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='grid min-w-0 content-start gap-6'>
          {/* Who the business is: its name and its marks */}
          <SettingsCard title={t('brandIdentity')}>
            <div className='grid gap-6 px-5 py-4'>
              <LocalizedInput
                id='brand-name'
                label={t('name')}
                value={name}
                onChange={setName}
                error={error ?? undefined}
              />
              <div className='grid gap-6 sm:grid-cols-2'>
                {MAIN_SLOTS.map(imageSlot)}
              </div>
              {/* Only the banner header shows it */}
              {imageSlot({
                slot: 'cover',
                label: 'brandCover',
                hint: 'brandCoverHint',
              })}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='group -ms-2'
                  >
                    <ChevronDown className='transition-transform group-data-[state=open]:rotate-180' />
                    {t('brandVariants')}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='grid gap-6 pt-4 sm:grid-cols-2'>
                  {VARIANT_SLOTS.map(imageSlot)}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </SettingsCard>
          {logoCleanup.dialog}

          {/* How the customer app looks */}
          <SettingsCard title={t('brandTheme')}>
            <div className='grid gap-4 px-5 py-4'>
              <FieldGrid className='items-start'>
                <ColorField
                  id='brand-color'
                  label={t('brandColor')}
                  value={color}
                  onChange={setColor}
                  hint={t('brandColorHint')}
                />
                <ColorField
                  id='brand-accent'
                  label={t('accentColor')}
                  value={theme.accent}
                  onChange={(accent) => setTheme({ ...theme, accent })}
                  hint={t('secondaryColorHint')}
                />
                <ColorField
                  id='brand-surface'
                  label={t('surfaceColor')}
                  value={theme.surface}
                  onChange={(surface) => setTheme({ ...theme, surface })}
                  fallback='#ffffff'
                  hint={t('surfaceColorHint')}
                />
                <Field
                  label={t('cornerRadius')}
                  htmlFor='brand-radius'
                  hint={t('cornerRadiusHint')}
                >
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
                </Field>
                <Field
                  label={t('dockColour')}
                  htmlFor='brand-dock'
                  hint={t('dockColourHint')}
                >
                  <Select
                    value={theme.slab || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, slab: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-dock' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('dockBrand')}</SelectItem>
                      <SelectItem value='neutral'>{t('dockBlack')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={t('menuLayout')}
                  htmlFor='brand-menu'
                  hint={t('menuLayoutHint')}
                >
                  <Select
                    value={theme.menuItem || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, menuItem: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-menu' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        {t('menuLayoutClassic')}
                      </SelectItem>
                      <SelectItem value='card'>
                        {t('menuLayoutGrid')}
                      </SelectItem>
                      <SelectItem value='compact'>
                        {t('menuLayoutCompact')}
                      </SelectItem>
                      <SelectItem value='hero'>
                        {t('menuLayoutMagazine')}
                      </SelectItem>
                      <SelectItem value='deck'>
                        {t('menuLayoutCards')}
                      </SelectItem>
                      <SelectItem value='tiles'>
                        {t('menuLayoutTiles')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {/* The Book tab is there only where places are booked or timed */}
                {(features.reservations || features.timeBilling) && (
                  <Field
                    label={t('placesLayout')}
                    htmlFor='brand-places'
                    hint={t('placesLayoutHint')}
                  >
                    <Select
                      value={theme.places || NONE}
                      onValueChange={(v) =>
                        setTheme({ ...theme, places: v === NONE ? '' : v })
                      }
                    >
                      <SelectTrigger id='brand-places' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>
                          {t('placesLayoutCards')}
                        </SelectItem>
                        <SelectItem value='list'>
                          {t('placesLayoutList')}
                        </SelectItem>
                        <SelectItem value='grid'>
                          {t('placesLayoutGrid')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field
                  label={t('startingTheme')}
                  htmlFor='brand-mode'
                  hint={t('startingThemeHint')}
                >
                  <Select
                    value={theme.mode || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, mode: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-mode' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('followDevice')}</SelectItem>
                      <SelectItem value='light'>
                        {t('themeLightOption')}
                      </SelectItem>
                      <SelectItem value='dark'>
                        {t('themeDarkOption')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={t('arabicStyleLabel')}
                  htmlFor='brand-arabic'
                  hint={t('arabicStyleLabelHint')}
                >
                  <Select value={arabicStyle} onValueChange={setArabicStyle}>
                    <SelectTrigger id='brand-arabic' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='standard'>
                        {t('arabicStandardOption')}
                      </SelectItem>
                      <SelectItem value='egyptian'>
                        {t('arabicEgyptianOption')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={t('contentLanguagesLabel')}
                  htmlFor='brand-content-languages'
                  hint={t('contentLanguagesHint')}
                >
                  <Select
                    value={contentLanguages}
                    onValueChange={(value) =>
                      setContentLanguages(value as ContentLanguages)
                    }
                  >
                    <SelectTrigger
                      id='brand-content-languages'
                      className='w-full'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='both'>
                        {t('contentLanguagesBoth')}
                      </SelectItem>
                      <SelectItem value='ar'>
                        {t('contentLanguagesAr')}
                      </SelectItem>
                      <SelectItem value='en'>
                        {t('contentLanguagesEn')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={t('headerSize')}
                  htmlFor='brand-header'
                  hint={t('headerSizeHint')}
                >
                  <Select
                    value={theme.headerSize || NONE}
                    onValueChange={(v) =>
                      setTheme({ ...theme, headerSize: v === NONE ? '' : v })
                    }
                  >
                    <SelectTrigger id='brand-header' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('defaultOption')}</SelectItem>
                      <SelectItem value='sm'>{t('headerSm')}</SelectItem>
                      <SelectItem value='md'>{t('headerMd')}</SelectItem>
                      <SelectItem value='lg'>{t('headerLg')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <FontSelect
                  id='brand-font-latin'
                  label={t('fontLatin')}
                  value={theme.fontLatin}
                  onChange={(fontLatin) => setTheme({ ...theme, fontLatin })}
                  fonts={LATIN_FONT_CATALOG}
                />
                <FontSelect
                  id='brand-font-arabic'
                  label={t('fontArabic')}
                  value={theme.fontArabic}
                  onChange={(fontArabic) => setTheme({ ...theme, fontArabic })}
                  fonts={ARABIC_FONT_CATALOG}
                />
              </FieldGrid>
              <Collapsible
                defaultOpen={Boolean(
                  theme.darkPrimary || theme.darkAccent || theme.darkSurface
                )}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='group -ms-2'
                  >
                    <ChevronDown className='transition-transform group-data-[state=open]:rotate-180' />
                    {t('darkScheme')}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='pt-3'>
                  <FieldGrid cols={3} className='items-start'>
                    <ColorField
                      id='brand-dark-primary'
                      label={t('brandColor')}
                      value={theme.darkPrimary}
                      onChange={(darkPrimary) =>
                        setTheme({ ...theme, darkPrimary })
                      }
                      placeholder={t('derived')}
                    />
                    <ColorField
                      id='brand-dark-accent'
                      label={t('accentColor')}
                      value={theme.darkAccent}
                      onChange={(darkAccent) =>
                        setTheme({ ...theme, darkAccent })
                      }
                      placeholder={t('derived')}
                    />
                    <ColorField
                      id='brand-dark-surface'
                      label={t('surfaceColor')}
                      value={theme.darkSurface}
                      onChange={(darkSurface) =>
                        setTheme({ ...theme, darkSurface })
                      }
                      fallback='#111111'
                      placeholder={t('derived')}
                    />
                  </FieldGrid>
                </CollapsibleContent>
              </Collapsible>
              <ContrastNotice
                input={{
                  primaryColor: orNull(color),
                  theme: fromThemeForm(theme),
                }}
              />
            </div>
          </SettingsCard>

          {/* Where and how guests order. The business's, not a branch's: every branch takes guests' orders the same way, and it changes live */}
          <SettingsCard title={t('guestOrdering')}>
            <div className='px-5 py-4'>
              <Field label={t('customerUrl')} htmlFor='brand-customer-url'>
                <Input
                  id='brand-customer-url'
                  type='url'
                  value={customerUrl}
                  onChange={(e) => setCustomerUrl(e.target.value)}
                  placeholder={defaultCustomerOrigin()}
                  dir='ltr'
                />
              </Field>
            </div>
            <SwitchRow
              className='px-5 py-4'
              title={t('guestOrdersAnywhere')}
              description={t('guestOrdersAnywhereHint')}
              checked={guestOrdersAnywhere}
              onCheckedChange={setGuestOrdersAnywhere}
            />
          </SettingsCard>

          {/* Which parts of the platform are on */}
          <SettingsCard title={t('features')}>
            {FEATURE_ROWS.filter(
              (row) =>
                (!row.needsPlaces || !cloudKitchen) &&
                (!row.addon || brand.entitlements?.[row.key] === true)
            ).map((row) => {
              // What the plan allows: a module outside it stays off, and says why
              const entitled = brand.entitlements?.[row.key] ?? true
              return (
                <SwitchRow
                  key={row.key}
                  className='px-5 py-4'
                  title={t(row.label)}
                  description={
                    entitled ? undefined : (
                      <span className='flex items-center gap-1'>
                        <Lock className='size-3.5' />
                        {t('notInPlan')}
                      </span>
                    )
                  }
                  checked={Boolean(entitled && features[row.key])}
                  disabled={!entitled}
                  onCheckedChange={(v) =>
                    setFeatures({ ...features, [row.key]: v })
                  }
                />
              )
            })}
          </SettingsCard>

          {/* One Save for the whole brand: the cards are one form, the preview shows the draft */}
          <div className='flex justify-end'>
            <Button type='submit' disabled={update.isPending}>
              {update.isPending && <Spinner />}
              {t('save')}
            </Button>
          </div>
        </div>

        <div className='flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:self-start'>
          <div className='flex items-center gap-2'>
            <PreviewToggles
              language={preview.language}
              scheme={preview.scheme}
              onLanguage={preview.setLanguage}
              onScheme={preview.setScheme}
            />
            <Badge variant={dirty ? 'secondary' : 'outline'}>
              {t(dirty ? 'draft' : 'previewLive')}
            </Badge>
          </div>
          <LivePreview
            customerUrl={customerOrigin}
            version={brand.version}
            language={preview.language}
            scheme={preview.scheme}
            draft={
              dirty
                ? { primaryColor: draft.primaryColor, theme: draft.theme }
                : null
            }
          />
        </div>
      </div>
    </form>
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
  fonts: readonly BrandFont[]
}) {
  const t = useT()
  return (
    <Field label={label} htmlFor={id}>
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(v === NONE ? '' : v)}
        onOpenChange={(open) => open && ensureFontPreviews(fonts)}
      >
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('defaultOption')}</SelectItem>
          <FontOptions catalog={fonts} displayLabel={t('fontDisplayGroup')} />
        </SelectContent>
      </Select>
    </Field>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
  fallback = DEFAULT_COLOR,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  fallback?: string
  /** What the empty field says; the default is the platform's own colour */
  placeholder?: string
  /** What the colour reaches, behind the label's ⓘ */
  hint?: string
}) {
  const t = useT()
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className='flex items-center gap-2'>
        <input
          id={id}
          type='color'
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className='h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1'
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t('defaultOption')}
          aria-label={label}
          className='font-mono'
          dir='ltr'
        />
        {value && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-9 shrink-0'
            aria-label={t('defaultOption')}
            onClick={() => onChange('')}
          >
            <X />
          </Button>
        )}
      </div>
    </Field>
  )
}
