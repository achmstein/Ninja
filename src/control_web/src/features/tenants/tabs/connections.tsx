import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import { MapsField } from '@/components/brand/maps-field'
import { SocialField } from '@/components/brand/social-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { tenantStatus } from '@/lib/tenant'
import { TalabatSection } from '../talabat-section'
import { useRecordSave } from '../record-save'
import { Section } from './business'

/**
 * What the business is reached through and joined to: where its customers
 * open it, how they sign in, Google's map, and Talabat. Each saves on its own.
 */
export function ConnectionsTab({ tenant }: { tenant: TenantDetail }) {
  const alive = !['Destroyed', 'Destroying'].includes(tenantStatus(tenant.status))
  return (
    <div className='grid items-start gap-4 lg:grid-cols-2'>
      <DomainCard key={`domain-${tenant.customerDomain}`} tenant={tenant} />
      <SignInCard key={`social-${tenant.socialSignIn}`} tenant={tenant} />
      <MapsCard key={`maps-${tenant.googleMaps}`} tenant={tenant} />
      {alive && <TalabatSection tenant={tenant} />}
    </div>
  )
}

function DomainCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const [domain, setDomain] = useState(tenant.customerDomain ?? '')
  return (
    <Section
      title={t('webAddress')}
      hint={t('webAddressHint')}
      dirty={domain.trim() !== (tenant.customerDomain ?? '')}
      pending={pending}
      onSave={() => save({ customerDomain: domain.trim() || null })}
    >
      <div className='grid gap-2'>
        <Label htmlFor='connections-domain'>{t('customerDomain')}</Label>
        <Input id='connections-domain' dir='ltr' placeholder='menu.example.com' value={domain} onChange={(e) => setDomain(e.target.value)} />
      </div>
      <a href={tenant.hosts.customer} target='_blank' rel='noreferrer' className='text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline' dir='ltr'>
        {tenant.hosts.customer.replace(/^https?:\/\//, '')}
        <ExternalLink className='size-3' />
      </a>
    </Section>
  )
}

function SignInCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const saved = tenant.socialSignIn ?? true
  const [social, setSocial] = useState(saved)
  return (
    <Section title={t('signInTitle')} dirty={social !== saved} pending={pending} onSave={() => save({ socialSignIn: social })}>
      <SocialField id='connections-social' checked={social} onChange={setSocial} />
    </Section>
  )
}

function MapsCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const saved = tenant.googleMaps ?? false
  const [maps, setMaps] = useState(saved)
  return (
    <Section title={t('googleMaps')} dirty={maps !== saved} pending={pending} onSave={() => save({ googleMaps: maps })}>
      <MapsField id='connections-maps' checked={maps} onChange={setMaps} available={tenant.googleMapsAvailable ?? false} />
      {/* Google takes the browser key only from the sites it lists: until this one is, its web keeps the free map */}
      {tenant.mapsDomainToAdd && (
        <p className='text-muted-foreground text-xs'>{t('googleMapsAddDomain', { pattern: `https://${tenant.mapsDomainToAdd}/*` })}</p>
      )}
    </Section>
  )
}
