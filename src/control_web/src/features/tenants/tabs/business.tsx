import { useMemo, useState, type ReactNode } from 'react'
import type { BusinessType, TenantDetail } from '@/api/control'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'
import { allTimeZones, COUNTRIES, countryOf, CURRENCIES } from '@/lib/locale'
import { seedLabelKey } from '@/lib/tenant'
import { BusinessPicker, ArabicStyleField, type ArabicStyle } from '../new-tenant-business'
import { ContentLanguagesField, contentLanguagesFrom } from '../new-tenant-locale'
import { useRecordSave } from '../record-save'

/**
 * Who the business is and where: its contact and notes, what kind of place
 * it is, and its country, money, time and languages. Each card saves on its
 * own; a running business takes the kind of place and the locale at once.
 */
export function BusinessTab({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <ContactCard key={`contact-${tenant.record.contactName}-${tenant.record.phone}-${tenant.record.address}-${tenant.record.notes}`} tenant={tenant} />
      <div className='flex flex-col gap-4'>
        <KindCard key={`kind-${tenant.businessType}`} tenant={tenant} />
        <LocaleCard key={`locale-${JSON.stringify(tenant.locale)}`} tenant={tenant} />
      </div>
    </div>
  )
}

export function Section({
  title,
  hint,
  dirty,
  pending,
  canSave = true,
  onSave,
  children,
}: {
  title: string
  hint?: string
  dirty: boolean
  pending: boolean
  canSave?: boolean
  onSave: () => void
  children: ReactNode
}) {
  const t = useT()
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle className='text-sm'>{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            if (dirty && canSave && !pending) onSave()
          }}
        >
          {children}
          <div className='flex justify-end'>
            <Button type='submit' size='sm' disabled={!dirty || !canSave || pending}>
              {pending && <Spinner />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ContactCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const [contactName, setContactName] = useState(tenant.record.contactName ?? '')
  const [phone, setPhone] = useState(tenant.record.phone ?? '')
  const [address, setAddress] = useState(tenant.record.address ?? '')
  const [notes, setNotes] = useState(tenant.record.notes ?? '')
  const dirty =
    contactName !== (tenant.record.contactName ?? '') ||
    phone !== (tenant.record.phone ?? '') ||
    address !== (tenant.record.address ?? '') ||
    notes !== (tenant.record.notes ?? '')

  return (
    <Section
      title={t('contact')}
      hint={t('businessContactHint')}
      dirty={dirty}
      pending={pending}
      onSave={() =>
        save({
          contactName: contactName.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        })
      }
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2'>
          <Label htmlFor='business-contact'>{t('contactName')}</Label>
          <Input id='business-contact' value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='business-phone'>{t('phone')}</Label>
          <Input id='business-phone' type='tel' dir='ltr' value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='business-address'>{t('address')}</Label>
        <Textarea id='business-address' rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='business-notes'>{t('notes')}</Label>
        <Textarea id='business-notes' rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Section>
  )
}

function KindCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const saved: BusinessType = tenant.businessType ?? 'Other'
  const [business, setBusiness] = useState<BusinessType>(saved)
  return (
    <Section
      title={t('businessType')}
      hint={`${t('businessTypeRecordHint')} ${t('startedWith', { seed: t(seedLabelKey[tenant.seed]) })}`}
      dirty={business !== saved}
      pending={pending}
      onSave={() => save({ businessType: business })}
    >
      <BusinessPicker id='business-kind' value={business} onChange={setBusiness} />
    </Section>
  )
}

function LocaleCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const saved = tenant.locale
  const [country, setCountry] = useState(saved.country)
  const [currency, setCurrency] = useState(saved.currency)
  const [timeZone, setTimeZone] = useState(saved.timeZone)
  const [language, setLanguage] = useState(saved.language)
  const [contentLanguages, setContentLanguages] = useState(contentLanguagesFrom(saved.contentLanguages))
  const savedArabic: ArabicStyle = saved.arabicStyle === 'egyptian' ? 'egyptian' : 'standard'
  const [arabicStyle, setArabicStyle] = useState<ArabicStyle>(savedArabic)

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
    setLanguage(c.language)
  }

  const dirty =
    country !== saved.country ||
    currency !== saved.currency ||
    timeZone !== saved.timeZone ||
    language !== saved.language ||
    contentLanguages !== contentLanguagesFrom(saved.contentLanguages) ||
    arabicStyle !== savedArabic

  return (
    <Section
      title={t('businessLocale')}
      hint={t('businessLocaleHint')}
      dirty={dirty}
      pending={pending}
      onSave={() => save({ country, currency, timeZone, defaultLanguage: language, contentLanguages, arabicStyle })}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2'>
          <Label htmlFor='business-country'>{t('country')}</Label>
          <Select value={country} onValueChange={pickCountry}>
            <SelectTrigger id='business-country' className='w-full'>
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
        <div className='grid gap-2'>
          <Label htmlFor='business-currency'>{t('currency')}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id='business-currency' className='w-full'>
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
          <Label htmlFor='business-tz'>{t('timeZone')}</Label>
          <Select value={timeZone} onValueChange={setTimeZone}>
            <SelectTrigger id='business-tz' className='w-full' dir='ltr'>
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
        <div className='grid gap-2'>
          <Label htmlFor='business-language'>{t('defaultLanguage')}</Label>
          <Select value={language} onValueChange={setLanguage} disabled={contentLanguages !== 'both'}>
            <SelectTrigger id='business-language' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='en'>{t('english')}</SelectItem>
              <SelectItem value='ar'>{t('arabic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ContentLanguagesField
        value={contentLanguages}
        onChange={(v) => {
          setContentLanguages(v)
          if (v !== 'both') setLanguage(v)
        }}
      />
      <ArabicStyleField value={arabicStyle} onChange={setArabicStyle} />
    </Section>
  )
}
