import { Link } from '@tanstack/react-router'
import { CalendarPlus, ChevronRight, ExternalLink } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import { useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { countryOf } from '@/lib/locale'
import { planLabelKey, seedLabelKey, tenantKind, tenantStatus } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import { JobLabel } from '@/features/platform/queue-table'
import { UpdateStanding } from '../dialogs'
import { Steps } from '../steps'
import type { TenantTab } from '../tenant-page'

const HOSTS: { key: keyof TenantDetail['hosts']; label: TranslationKey }[] = [
  { key: 'customer', label: 'hostCustomer' },
  { key: 'admin', label: 'hostAdmin' },
  { key: 'pos', label: 'hostPos' },
  { key: 'kds', label: 'hostKds' },
  { key: 'api', label: 'hostApi' },
]

const dlClass = 'grid grid-cols-[auto_1fr] content-start items-center gap-x-4 gap-y-2 text-sm'
const dtClass = 'text-muted-foreground'

/**
 * Where the stack lives, who owns it, what we know about the business, and the
 * latest run. The record column edits in a sheet; the rest is the stack's.
 */
export function OverviewTab({ tenant, onExtend }: { tenant: TenantDetail; onExtend: () => void }) {
  const t = useT()
  const format = useFormat()

  const status = tenantStatus(tenant.status)
  const kind = tenantKind(tenant.kind)
  const alive = status !== 'Destroyed' && status !== 'Destroying'
  const country = countryOf(tenant.locale.country)
  const { record, locale } = tenant

  return (
    <div className='flex flex-col gap-6'>
      <StillToDo tenant={tenant} />
      <section className='grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3'>
        <dl className={dlClass}>
          <dt className={dtClass}>{t('hosts')}</dt>
          <dd className='flex min-w-0 flex-col gap-1'>
            {HOSTS.map(({ key, label }) => (
              <a
                key={key}
                href={tenant.hosts[key]}
                target='_blank'
                rel='noreferrer'
                className='inline-flex min-w-0 items-center gap-1.5 hover:underline'
              >
                <span className='text-muted-foreground w-16 shrink-0'>{t(label)}</span>
                <span className='truncate' dir='ltr'>
                  {tenant.hosts[key].replace(/^https?:\/\//, '')}
                </span>
                <ExternalLink className='text-muted-foreground size-3 shrink-0' />
              </a>
            ))}
          </dd>
        </dl>

        <dl className={dlClass}>
          <dt className={dtClass}>{t('owner')}</dt>
          <dd className='flex min-w-0 items-center gap-1'>
            <span className='truncate' dir='ltr'>
              {tenant.ownerEmail}
            </span>
            <CopyButton value={tenant.ownerEmail} />
          </dd>
          {tenant.ownerInitialPassword && (
            <>
              <dt className={dtClass}>{t('initialPassword')}</dt>
              <dd className='flex items-center gap-1'>
                <span className='font-mono' dir='ltr'>
                  {tenant.ownerInitialPassword}
                </span>
                <CopyButton value={tenant.ownerInitialPassword} />
              </dd>
            </>
          )}
          {kind === 'Demo' && (
            <>
              <dt className={dtClass}>{t('expires')}</dt>
              <dd className='flex items-center gap-2'>
                <span>{format.dateTime(tenant.expiresAt) || '—'}</span>
                {alive && (
                  <Button variant='ghost' size='sm' className='h-7 px-2' onClick={onExtend}>
                    <CalendarPlus />
                    {t('extend')}
                  </Button>
                )}
              </dd>
            </>
          )}
          <dt className={dtClass}>{t('imageTag')}</dt>
          <dd>
            <span className='font-mono' dir='ltr'>
              {tenant.imageTag}
            </span>
            <span className='text-muted-foreground block text-xs'>
              <UpdateStanding tag={tenant.imageTag} update={tenant.update} />
            </span>
          </dd>
          {tenant.previousImageTag && (
            <>
              <dt className={dtClass}>{t('previousVersion')}</dt>
              <dd className='font-mono' dir='ltr'>
                {tenant.previousImageTag}
              </dd>
            </>
          )}
          <dt className={dtClass}>{t('created')}</dt>
          <dd>{format.dateTime(tenant.createdAt)}</dd>
          {tenant.provisionedAt && (
            <>
              <dt className={dtClass}>{t('provisioned')}</dt>
              <dd>{format.dateTime(tenant.provisionedAt)}</dd>
            </>
          )}
          <dt className={dtClass}>{t('welcomeSent')}</dt>
          <dd>{tenant.welcomeSentAt ? format.dateTime(tenant.welcomeSentAt) : t('never')}</dd>
          {tenant.jobs.length > 0 && (
            <>
              <dt className={dtClass}>{t('tabQueue')}</dt>
              <dd className='flex flex-col gap-0.5'>
                {tenant.jobs.map((job) => (
                  <span key={job.id}>
                    <JobLabel job={job} />
                    <span className='text-muted-foreground'>
                      {' · '}
                      {job.status === 'Running'
                        ? t('laneRunning')
                        : t('positionInLine', { position: job.position ?? 0 })}
                    </span>
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>

        <dl className={dlClass}>
          <Edited tab='business' slug={tenant.slug} label={t('tabBusiness')} />
          <dt className={dtClass}>{t('contact')}</dt>
          <dd className='truncate'>{record.contactName || '—'}</dd>
          <dt className={dtClass}>{t('phone')}</dt>
          <dd className='truncate' dir='ltr'>
            {record.phone || '—'}
          </dd>
          <dt className={dtClass}>{t('country')}</dt>
          <dd>
            {country?.name.en ?? locale.country} · {locale.currency}
          </dd>
          <dt className={dtClass}>{t('seed')}</dt>
          <dd>{t(seedLabelKey[tenant.seed])}</dd>
          {record.notes && (
            <>
              <dt className={dtClass}>{t('notes')}</dt>
              <dd className='line-clamp-3 whitespace-pre-line'>{record.notes}</dd>
            </>
          )}
          <Edited tab='subscription' slug={tenant.slug} label={t('tabSubscription')} />
          <dt className={dtClass}>{t('plan')}</dt>
          <dd>{t(planLabelKey[record.plan])}</dd>
          <Edited tab='connections' slug={tenant.slug} label={t('tabConnections')} />
          <dt className={dtClass}>{t('ownDomain')}</dt>
          <dd className='truncate' dir={tenant.customerDomain ? 'ltr' : undefined}>
            {tenant.customerDomain ?? '—'}
          </dd>
          <dt className={dtClass}>{t('googleMaps')}</dt>
          <dd>
            {tenant.googleMaps
              ? tenant.googleMapsAvailable
                ? t('googleMapsOn')
                : t('googleMapsOnNoKeys')
              : t('googleMapsOff')}
          </dd>
          <Edited tab='app' slug={tenant.slug} label={t('tabApp')} />
          <dt className={dtClass}>{t('customerApp')}</dt>
          <dd className='truncate' dir={tenant.appId ? 'ltr' : undefined}>
            {tenant.appId ?? t('sharedApp')}
          </dd>
        </dl>
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-medium'>{t('steps')}</h2>
        <Steps steps={tenant.steps} />
      </section>
    </div>
  )
}

/** A heading over the values edited on one tab, linking there */
function Edited({ tab, slug, label }: { tab: TenantTab; slug: string; label: string }) {
  return (
    <>
      <dt className='text-muted-foreground col-span-2 mt-2 text-xs font-medium tracking-wide uppercase first:mt-0'>
        <Link
          to='/t/$slug'
          params={{ slug }}
          search={{ tab }}
          className='inline-flex items-center gap-1 hover:underline'
        >
          {label}
          <ChevronRight className='size-3' />
        </Link>
      </dt>
    </>
  )
}

/**
 * What a business still lacks to be fully set up, each a link to the tab that
 * fixes it. Nothing shows once everything is in place.
 */
function StillToDo({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const status = tenantStatus(tenant.status)
  if (status === 'Destroyed' || status === 'Destroying') return null
  const items: { tab: TenantTab; label: string }[] = []
  if (!tenant.record.contactName && !tenant.record.phone) items.push({ tab: 'business', label: t('todoContact') })
  if (tenantKind(tenant.kind) === 'Customer' && !tenant.customerDomain)
    items.push({ tab: 'connections', label: t('todoDomain') })
  if (tenant.mapsDomainToAdd)
    items.push({ tab: 'connections', label: t('todoMapsDomain', { domain: tenant.mapsDomainToAdd }) })
  if (tenant.appId && !tenant.appleTeamId) items.push({ tab: 'app', label: t('todoAppleTeam') })
  // One may be enough (an app Play signs with its upload key): only none at all is surely missing
  if (tenant.appId && (tenant.androidCertFingerprints?.length ?? 0) === 0)
    items.push({ tab: 'app', label: t('todoPlayFingerprint') })
  if (items.length === 0) return null
  return (
    <section className='rounded-lg border border-amber-500/40 bg-amber-500/5 p-3'>
      <h2 className='mb-2 text-sm font-medium'>{t('stillToDo')}</h2>
      <ul className='flex flex-col gap-1 text-sm'>
        {items.map((item) => (
          <li key={item.label}>
            <Link
              to='/t/$slug'
              params={{ slug: tenant.slug }}
              search={{ tab: item.tab }}
              className='inline-flex items-center gap-1 hover:underline'
            >
              {item.label}
              <ChevronRight className='size-3' />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
