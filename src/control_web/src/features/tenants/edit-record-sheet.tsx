import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BusinessType, TenantDetail } from '@/api/control'
import {
  getTenantQueryKey,
  listTenantsQueryKey,
  updateTenantMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { ColorField } from '@/components/brand/color-field'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
} from '@/components/localized-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'
import { allTimeZones, COUNTRIES, countryOf, CURRENCIES } from '@/lib/locale'
import { problemDetail } from '@/lib/problem'
import {
  isHexColor,
  planLabelKey,
  TENANT_PLANS,
  type TenantPlanName,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'
import {
  BusinessPicker,
  LookFields,
  type ArabicStyle,
  type DefaultTheme,
} from './new-tenant-business'

const FORM_ID = 'edit-record'

/**
 * The record Control keeps about a café, edited in place: names, colour,
 * domain, contact, plan, notes, and what the wizard chose — the kind of
 * place, the locale, its Arabic and starting theme. A running café takes
 * the name, locale, Arabic, theme and kind at once. The form mounts with
 * the sheet, so every opening starts from what the server has.
 */
export function EditRecordSheet({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: TenantDetail
}) {
  const t = useT()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('editRecord')}</SheetTitle>
          <SheetDescription className='sr-only'>{t('editRecord')}</SheetDescription>
        </SheetHeader>
        <RecordForm tenant={tenant} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function RecordForm({ tenant, onClose }: { tenant: TenantDetail; onClose: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()

  const [name, setName] = useState(toLocalizedValue({ en: tenant.nameEn, ar: tenant.nameAr }))
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor ?? '')
  const [customerDomain, setCustomerDomain] = useState(tenant.customerDomain ?? '')
  const [contactName, setContactName] = useState(tenant.record.contactName ?? '')
  const [phone, setPhone] = useState(tenant.record.phone ?? '')
  const [address, setAddress] = useState(tenant.record.address ?? '')
  const [plan, setPlan] = useState<TenantPlanName>(tenant.record.plan)
  const [notes, setNotes] = useState(tenant.record.notes ?? '')
  const [country, setCountry] = useState(tenant.locale.country)
  const [currency, setCurrency] = useState(tenant.locale.currency)
  const [timeZone, setTimeZone] = useState(tenant.locale.timeZone)
  const [defaultLanguage, setDefaultLanguage] = useState(tenant.locale.language)
  const [business, setBusiness] = useState<BusinessType>(tenant.businessType ?? 'Other')
  const [arabicStyle, setArabicStyle] = useState<ArabicStyle>(
    tenant.locale.arabicStyle === 'egyptian' ? 'egyptian' : 'standard'
  )
  const [defaultTheme, setDefaultTheme] = useState<DefaultTheme>(
    tenant.defaultTheme === 'light' || tenant.defaultTheme === 'dark' ? tenant.defaultTheme : 'device'
  )

  // The country's own zones first, then every zone the browser knows
  const zones = useMemo(() => {
    const own = countryOf(country)?.timeZones ?? []
    const rest = allTimeZones().filter((z) => !own.includes(z))
    const all = [...own, ...rest]
    return timeZone && !all.includes(timeZone) ? [timeZone, ...all] : all
  }, [country, timeZone])

  const pickCountry = (code: string) => {
    setCountry(code)
    const c = countryOf(code)
    if (!c) return
    setCurrency(c.currency)
    setTimeZone(c.timeZones[0])
    setDefaultLanguage(c.language)
  }

  const save = useMutation({
    ...updateTenantMutation(),
    onSuccess: (detail) => {
      queryClient.setQueryData(getTenantQueryKey({ path: { slug: tenant.slug } }), detail)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('recordSaved'))
      onClose()
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const colorOk = primaryColor === '' || isHexColor(primaryColor)
  const canSubmit = name.en.trim().length > 0 && colorOk && !save.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const localized = fromLocalizedValue(name)
    save.mutate({
      path: { slug: tenant.slug },
      body: {
        nameEn: localized.en,
        nameAr: localized.ar,
        primaryColor: primaryColor ? primaryColor.toLowerCase() : null,
        customerDomain: customerDomain.trim() || null,
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        plan,
        notes: notes.trim() || null,
        country,
        currency,
        timeZone,
        defaultLanguage,
        arabicStyle,
        defaultTheme,
        businessType: business,
      },
    })
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} className='flex flex-1 flex-col gap-4 overflow-y-auto px-4'>
        <LocalizedInput id='record-name' label={t('name')} value={name} onChange={setName} autoFocus />
        <div className='grid gap-2'>
          <Label htmlFor='record-business'>{t('businessType')}</Label>
          <BusinessPicker id='record-business' value={business} onChange={setBusiness} />
          <p className='text-muted-foreground text-xs'>{t('businessTypeRecordHint')}</p>
        </div>
        <ColorField
          id='record-color'
          label={t('brandColor')}
          value={primaryColor}
          onChange={setPrimaryColor}
        />
        <div className='grid gap-2'>
          <Label htmlFor='record-domain'>{t('customerDomain')}</Label>
          <Input
            id='record-domain'
            dir='ltr'
            placeholder='menu.example.com'
            value={customerDomain}
            onChange={(e) => setCustomerDomain(e.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-contact'>{t('contactName')}</Label>
          <Input id='record-contact' value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-phone'>{t('phone')}</Label>
          <Input
            id='record-phone'
            type='tel'
            dir='ltr'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-address'>{t('address')}</Label>
          <Textarea id='record-address' rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-plan'>{t('plan')}</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as TenantPlanName)}>
            <SelectTrigger id='record-plan' className='w-full'>
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
        <div className='grid gap-2'>
          <Label htmlFor='record-notes'>{t('notes')}</Label>
          <Textarea id='record-notes' rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-country'>{t('country')}</Label>
          <Select value={country} onValueChange={pickCountry}>
            <SelectTrigger id='record-country' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='record-currency'>{t('currency')}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id='record-currency' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='record-language'>{t('defaultLanguage')}</Label>
            <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
              <SelectTrigger id='record-language' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='en'>{t('english')}</SelectItem>
                <SelectItem value='ar'>{t('arabic')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='record-tz'>{t('timeZone')}</Label>
          <Select value={timeZone} onValueChange={setTimeZone}>
            <SelectTrigger id='record-tz' className='w-full' dir='ltr'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir='ltr'>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <LookFields
          arabicStyle={arabicStyle}
          onArabicStyle={setArabicStyle}
          defaultTheme={defaultTheme}
          onDefaultTheme={setDefaultTheme}
        />
      </form>
      <SheetFooter className='flex-row justify-end'>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button type='submit' form={FORM_ID} disabled={!canSubmit}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </SheetFooter>
    </>
  )
}
