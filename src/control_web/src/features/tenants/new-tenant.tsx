import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import {
  createTenantMutation,
  getPlansOptions,
  getPlatformCapacityOptions,
  getPlatformOptions,
  listTenantsQueryKey,
  uploadTenantSeedImageMutation,
} from '@/api/control/@tanstack/react-query.gen'
import type { CreateTenantRequest } from '@/api/control'
import { ColorField } from '@/components/brand/color-field'
import { ImageSlotGrid, SLOT_LABELS } from '@/components/brand/image-slots'
import {
  PhonePreview,
  PreviewToggles,
  usePreviewState,
  type PreviewDraft,
} from '@/components/brand/phone-preview'
import {
  LocalizedInput,
  fromLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { IMAGE_SLOTS, imagesFromUrls, type ImageSlot } from '@/lib/brand-slots'
import { megabytes } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Language } from '@/lib/language'
import { COUNTRIES, countryOf, type Country } from '@/lib/locale'
import { problemDetail } from '@/lib/problem'
import {
  MODULES,
  SEED_DEFAULT,
  TENANT_KINDS,
  TENANT_PLANS,
  isHexColor,
  isValidSlug,
  kindLabelKey,
  moduleLabelKey,
  moduleName,
  planLabelKey,
  type ModuleName,
  seedLabelKey,
  slugFrom,
  type TenantKindName,
  type TenantPlanName,
  type TenantSeedName,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'
import { LocaleFields } from './new-tenant-locale'
import {
  BusinessPicker,
  LookFields,
  SUGGESTED_MODULES,
  type ArabicStyle,
  type DefaultTheme,
} from './new-tenant-business'
import type { BusinessType } from '@/api/control'

type SlotFiles = Partial<Record<ImageSlot, File>>

/**
 * An object URL per picked file, made once per file and revoked when the
 * file leaves the form or the form unmounts.
 */
function useObjectUrls(files: SlotFiles): Partial<Record<ImageSlot, string>> {
  const cache = useRef(new Map<File, string>())
  const urls = useMemo(() => {
    const next: Partial<Record<ImageSlot, string>> = {}
    const live = new Set<File>()
    for (const slot of IMAGE_SLOTS) {
      const file = files[slot]
      if (!file) continue
      live.add(file)
      let url = cache.current.get(file)
      if (!url) {
        url = URL.createObjectURL(file)
        cache.current.set(file, url)
      }
      next[slot] = url
    }
    for (const [file, url] of cache.current) {
      if (!live.has(file)) {
        URL.revokeObjectURL(url)
        cache.current.delete(file)
      }
    }
    return next
  }, [files])
  useEffect(() => {
    const held = cache.current
    return () => {
      held.forEach((url) => URL.revokeObjectURL(url))
      held.clear()
    }
  }, [])
  return urls
}

const FIRST_COUNTRY: Country = COUNTRIES[0]

/** The sample menu first: it is what a demo wants and the toggle reads left to right */
const SEED_ORDER: TenantSeedName[] = ['Sample', 'None']

/**
 * One form, one call. The slug follows the English name until it is edited
 * by hand; the seed follows the kind and the money, clock and first
 * language follow the country, each until touched. The images picked here
 * are uploaded right after the 201: provisioning is queued, so they land
 * before the stack step reads them. The phone beside the form shows the
 * draft as customers will see it.
 */
export function NewTenantPage() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const platform = useQuery(getPlatformOptions())
  const capacity = useQuery(getPlatformCapacityOptions({ query: { refresh: false } }))
  const preview = usePreviewState()

  // Identity
  const [name, setName] = useState<LocalizedValue>({ en: '', ar: '' })
  const [ownerEmail, setOwnerEmail] = useState('')
  const [kind, setKind] = useState<TenantKindName>('Demo')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [seed, setSeed] = useState<TenantSeedName>(SEED_DEFAULT.Demo)
  const [seedTouched, setSeedTouched] = useState(false)
  const [customerDomain, setCustomerDomain] = useState('')
  const [demoDays, setDemoDays] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [plan, setPlan] = useState<TenantPlanName>('Free')
  const [addons, setAddons] = useState<ModuleName[]>(SUGGESTED_MODULES.CoffeeShop)
  const [addonsTouched, setAddonsTouched] = useState(false)
  const [business, setBusiness] = useState<BusinessType>('CoffeeShop')
  const [arabicStyle, setArabicStyle] = useState<ArabicStyle>(
    FIRST_COUNTRY.code === 'EG' ? 'egyptian' : 'standard'
  )
  const [arabicTouched, setArabicTouched] = useState(false)
  const [defaultTheme, setDefaultTheme] = useState<DefaultTheme>('device')
  const plans = useQuery(getPlansOptions())
  const planRow = plans.data?.plans.find((p) => p.plan === plan)
  const included = new Set((planRow?.included ?? []).map(moduleName))
  const [notes, setNotes] = useState('')

  // Locale
  const [countryCode, setCountryCode] = useState(FIRST_COUNTRY.code)
  const [currency, setCurrency] = useState(FIRST_COUNTRY.currency)
  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [timeZone, setTimeZone] = useState(FIRST_COUNTRY.timeZones[0])
  const [timeZoneTouched, setTimeZoneTouched] = useState(false)
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(FIRST_COUNTRY.language)
  const [languageTouched, setLanguageTouched] = useState(false)

  // Brand
  const [color, setColor] = useState('')
  const [files, setFiles] = useState<SlotFiles>({})
  const objectUrls = useObjectUrls(files)

  // Capacity
  const [force, setForce] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugFrom(name.en)
  const defaultDemoDays = Number(platform.data?.demoDays ?? 14)
  const dialCode = countryOf(countryCode)?.dialCode
  const noRoom = capacity.data != null && Number(capacity.data.roomFor) === 0

  const uploadImage = useMutation(uploadTenantSeedImageMutation())

  const create = useMutation({
    ...createTenantMutation(),
    onSuccess: async (tenant) => {
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      const picked = IMAGE_SLOTS.flatMap((slot) => {
        const file = files[slot]
        return file ? [{ slot, file }] : []
      })
      const results = await Promise.allSettled(
        picked.map(({ slot, file }) =>
          uploadImage.mutateAsync({
            path: { slug: tenant.slug, slot },
            body: { file },
          })
        )
      )
      results.forEach((result, i) => {
        if (result.status === 'rejected')
          toast.error(t('imageUploadFailed', { slot: t(SLOT_LABELS[picked[i].slot]) }))
      })
      toast.success(t('tenantCreated'))
      navigate({ to: '/t/$slug', params: { slug: tenant.slug } })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const canSubmit =
    name.en.trim().length > 0 &&
    ownerEmail.includes('@') &&
    isValidSlug(effectiveSlug) &&
    (color === '' || isHexColor(color)) &&
    !(noRoom && !force) &&
    !create.isPending

  const pickKind = (next: TenantKindName) => {
    setKind(next)
    if (!seedTouched) setSeed(SEED_DEFAULT[next])
  }

  // The kind of place ticks the add-ons it usually needs, until someone picks their own
  const pickBusiness = (next: BusinessType) => {
    setBusiness(next)
    if (!addonsTouched) setAddons(SUGGESTED_MODULES[next])
  }

  const pickCountry = (country: Country) => {
    setCountryCode(country.code)
    // An Egyptian café speaks Egyptian; anywhere else, Standard — until chosen
    if (!arabicTouched) setArabicStyle(country.code === 'EG' ? 'egyptian' : 'standard')
    if (!currencyTouched) setCurrency(country.currency)
    if (!timeZoneTouched) setTimeZone(country.timeZones[0])
    if (!languageTouched) setDefaultLanguage(country.language)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const localized = fromLocalizedValue(name)
    const body: CreateTenantRequest = {
      nameEn: localized.en,
      nameAr: localized.ar,
      ownerEmail: ownerEmail.trim(),
      kind,
      seed,
      country: countryCode,
      currency,
      timeZone,
      defaultLanguage,
      slug: effectiveSlug,
      primaryColor: color ? color.toLowerCase() : null,
      customerDomain: kind === 'Customer' ? customerDomain.trim() || null : null,
      demoDays: kind === 'Demo' && demoDays.trim() !== '' ? Number(demoDays) : null,
      contactName: contactName.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      plan,
      addons: addons.filter((m) => !included.has(m)),
      businessType: business,
      arabicStyle,
      defaultTheme: defaultTheme === 'device' ? null : defaultTheme,
      notes: notes.trim() || null,
      provision: true,
      force,
    }
    create.mutate({ body })
  }

  const draft: PreviewDraft = {
    name,
    primaryColor: color || null,
    theme: null,
    images: imagesFromUrls(objectUrls),
    currency,
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader back={{ to: '/' }} title={t('newTenant')} />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <form onSubmit={submit} className='flex min-w-0 flex-col gap-6'>
          <Card>
            <CardHeader>
              <CardTitle>{t('businessType')}</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-2'>
              <BusinessPicker id='businessType' value={business} onChange={pickBusiness} />
              <p className='text-muted-foreground text-xs'>{t('businessTypeHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('record')}</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <LocalizedInput
                id='name'
                label={t('name')}
                value={name}
                onChange={setName}
                autoFocus
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='ownerEmail'>{t('ownerEmail')}</Label>
                  <Input
                    id='ownerEmail'
                    type='email'
                    dir='ltr'
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='kind'>{t('kind')}</Label>
                  <Select value={kind} onValueChange={(v) => pickKind(v as TenantKindName)}>
                    <SelectTrigger id='kind' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TENANT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(kindLabelKey[k])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='slug'>{t('slug')}</Label>
                  <Input
                    id='slug'
                    dir='ltr'
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlug(e.target.value.toLowerCase())
                    }}
                    aria-invalid={effectiveSlug !== '' && !isValidSlug(effectiveSlug)}
                    className='font-mono'
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>{t('seed')}</Label>
                  <ToggleGroup
                    type='single'
                    variant='outline'
                    value={seed}
                    onValueChange={(v) => {
                      if (!v) return
                      setSeed(v as TenantSeedName)
                      setSeedTouched(true)
                    }}
                    aria-label={t('seed')}
                    className='w-full'
                  >
                    {SEED_ORDER.map((s) => (
                      <ToggleGroupItem key={s} value={s} className='flex-1'>
                        {t(seedLabelKey[s])}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                {kind === 'Customer' && (
                  <div className='grid gap-2 sm:col-span-2'>
                    <Label htmlFor='customerDomain'>{t('customerDomain')}</Label>
                    <Input
                      id='customerDomain'
                      dir='ltr'
                      placeholder='menu.example.com'
                      value={customerDomain}
                      onChange={(e) => setCustomerDomain(e.target.value)}
                    />
                  </div>
                )}
                {kind === 'Demo' && (
                  <div className='grid gap-2'>
                    <Label htmlFor='demoDays'>{t('demoDays')}</Label>
                    <Input
                      id='demoDays'
                      type='number'
                      min={1}
                      inputMode='numeric'
                      placeholder={String(defaultDemoDays)}
                      value={demoDays}
                      onChange={(e) => setDemoDays(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button type='button' variant='ghost' size='sm' className='group -ms-2'>
                    <ChevronDown className='me-1 size-4 transition-transform group-data-[state=open]:rotate-180' />
                    {t('contact')}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='grid gap-4 pt-4 sm:grid-cols-2'>
                  <div className='grid gap-2'>
                    <Label htmlFor='contactName'>{t('contactName')}</Label>
                    <Input
                      id='contactName'
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='phone'>{t('phone')}</Label>
                    <Input
                      id='phone'
                      type='tel'
                      dir='ltr'
                      placeholder={dialCode}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className='grid gap-2 sm:col-span-2'>
                    <Label htmlFor='address'>{t('address')}</Label>
                    <Textarea
                      id='address'
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='plan'>{t('plan')}</Label>
                    <Select value={plan} onValueChange={(v) => setPlan(v as TenantPlanName)}>
                      <SelectTrigger id='plan' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TENANT_PLANS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(planLabelKey[p])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2 sm:col-span-2'>
                    <Label>{t('modules')}</Label>
                    {kind === 'Demo' && <p className='text-muted-foreground text-xs'>{t('demoHasEverything')}</p>}
                    <div className='grid gap-2 sm:grid-cols-2'>
                      {MODULES.map((m) => {
                        const isIncluded = included.has(m)
                        return (
                          <label key={m} className='flex items-center gap-2 text-sm'>
                            <Checkbox
                              checked={isIncluded || addons.includes(m)}
                              disabled={isIncluded || kind === 'Demo'}
                              onCheckedChange={(v) => {
                                setAddonsTouched(true)
                                setAddons((a) => (v === true ? [...a, m] : a.filter((x) => x !== m)))
                              }}
                            />
                            {t(moduleLabelKey[m])}
                            {isIncluded && <span className='text-muted-foreground text-xs'>· {t('includedInPlan')}</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div className='grid gap-2 sm:col-span-2'>
                    <Label htmlFor='notes'>{t('notes')}</Label>
                    <Textarea
                      id='notes'
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('locale')}</CardTitle>
            </CardHeader>
            <CardContent>
              <LocaleFields
                value={{ country: countryCode, currency, timeZone, defaultLanguage }}
                onCountry={pickCountry}
                onCurrency={(v) => {
                  setCurrency(v)
                  setCurrencyTouched(true)
                }}
                onTimeZone={(v) => {
                  setTimeZone(v)
                  setTimeZoneTouched(true)
                }}
                onDefaultLanguage={(v) => {
                  setDefaultLanguage(v)
                  setLanguageTouched(true)
                }}
              />
              <div className='mt-4'>
                <LookFields
                  arabicStyle={arabicStyle}
                  onArabicStyle={(v) => {
                    setArabicStyle(v)
                    setArabicTouched(true)
                  }}
                  defaultTheme={defaultTheme}
                  onDefaultTheme={setDefaultTheme}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('brand')}</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-6'>
              <ColorField
                id='primaryColor'
                label={t('brandColor')}
                value={color}
                onChange={setColor}
                swatchesFrom={files.logo ?? null}
                eyedropper
              />
              <ImageSlotGrid
                srcOf={(slot) => objectUrls[slot] ?? null}
                onUpload={(slot, file) => setFiles((prev) => ({ ...prev, [slot]: file }))}
                onRemove={(slot) =>
                  setFiles((prev) => {
                    const next = { ...prev }
                    delete next[slot]
                    return next
                  })
                }
              />
            </CardContent>
          </Card>

          {noRoom && (
            <Alert variant='destructive'>
              <TriangleAlert />
              <AlertTitle>{t('noRoom')}</AlertTitle>
              <AlertDescription>
                <div className='flex flex-wrap gap-x-4 gap-y-1'>
                  <span>
                    {t('memory')} {megabytes(Number(capacity.data?.memAvailableMb))}
                  </span>
                  <span>
                    {t('stackFootprint')} {megabytes(Number(capacity.data?.stackFootprintMb))}
                  </span>
                </div>
                <Label htmlFor='force' className='text-foreground pt-1'>
                  <Checkbox
                    id='force'
                    checked={force}
                    onCheckedChange={(v) => setForce(v === true)}
                  />
                  {t('forceCreate')}
                </Label>
              </AlertDescription>
            </Alert>
          )}

          <div className='flex justify-end gap-2'>
            <Button asChild variant='outline' type='button'>
              <Link to='/'>{t('cancel')}</Link>
            </Button>
            <Button type='submit' disabled={!canSubmit}>
              {create.isPending && <Spinner />}
              {t('create')}
            </Button>
          </div>
        </form>

        <aside className='flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start'>
          <PreviewToggles
            language={preview.language}
            scheme={preview.scheme}
            onLanguage={preview.setLanguage}
            onScheme={preview.setScheme}
          />
          <PhonePreview draft={draft} language={preview.language} scheme={preview.scheme} />
        </aside>
      </div>
    </div>
  )
}
