import { useState } from 'react'
import { CalendarPlus, ExternalLink, Pencil } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { countryOf } from '@/lib/locale'
import { planLabelKey, seedLabelKey, tenantKind, tenantStatus } from '@/lib/tenant'
import { UpdateStanding } from '../dialogs'
import { EditRecordSheet } from '../edit-record-sheet'
import { Steps } from '../steps'
import { JobLabel } from '@/features/platform/queue-table'

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
 * Where the stack lives, who owns it, what we know about the café, and the
 * latest run. The record column edits in a sheet; the rest is the stack's.
 */
export function OverviewTab({
  tenant,
  onExtend,
}: {
  tenant: TenantDetail
  onExtend: () => void
}) {
  const t = useT()
  const format = useFormat()
  const [editing, setEditing] = useState(false)

  const status = tenantStatus(tenant.status)
  const kind = tenantKind(tenant.kind)
  const alive = status !== 'Destroyed' && status !== 'Destroying'
  const country = countryOf(tenant.locale.country)
  const { record, locale } = tenant

  return (
    <div className='flex flex-col gap-6'>
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
            <span className='truncate' dir='ltr'>{tenant.ownerEmail}</span>
            <CopyButton value={tenant.ownerEmail} />
          </dd>
          {tenant.ownerInitialPassword && (
            <>
              <dt className={dtClass}>{t('initialPassword')}</dt>
              <dd className='flex items-center gap-1'>
                <span className='font-mono' dir='ltr'>{tenant.ownerInitialPassword}</span>
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
            <span className='font-mono' dir='ltr'>{tenant.imageTag}</span>
            <span className='text-muted-foreground block text-xs'>
              <UpdateStanding tag={tenant.imageTag} update={tenant.update} />
            </span>
          </dd>
          {tenant.previousImageTag && (
            <>
              <dt className={dtClass}>{t('previousVersion')}</dt>
              <dd className='font-mono' dir='ltr'>{tenant.previousImageTag}</dd>
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
                      {job.status === 'Running' ? t('laneRunning') : t('positionInLine', { position: job.position ?? 0 })}
                    </span>
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>

        <dl className={dlClass}>
          <dt className={dtClass}>{t('record')}</dt>
          <dd className='flex justify-end'>
            <Button variant='ghost' size='sm' className='h-7 px-2' onClick={() => setEditing(true)}>
              <Pencil />
              {t('edit')}
            </Button>
          </dd>
          <dt className={dtClass}>{t('contact')}</dt>
          <dd className='truncate'>{record.contactName || '—'}</dd>
          <dt className={dtClass}>{t('phone')}</dt>
          <dd className='truncate' dir='ltr'>{record.phone || '—'}</dd>
          <dt className={dtClass}>{t('address')}</dt>
          <dd className='whitespace-pre-line'>{record.address || '—'}</dd>
          <dt className={dtClass}>{t('plan')}</dt>
          <dd>{t(planLabelKey[record.plan])}</dd>
          <dt className={dtClass}>{t('country')}</dt>
          <dd>{country?.name.en ?? locale.country}</dd>
          <dt className={dtClass}>{t('currency')}</dt>
          <dd>{locale.currency}</dd>
          <dt className={dtClass}>{t('timeZone')}</dt>
          <dd dir='ltr'>{locale.timeZone}</dd>
          <dt className={dtClass}>{t('defaultLanguage')}</dt>
          <dd>{locale.language === 'ar' ? t('arabic') : t('english')}</dd>
          <dt className={dtClass}>{t('seed')}</dt>
          <dd>{t(seedLabelKey[tenant.seed])}</dd>
          {tenant.customerDomain && (
            <>
              <dt className={dtClass}>{t('ownDomain')}</dt>
              <dd className='truncate' dir='ltr'>{tenant.customerDomain}</dd>
            </>
          )}
          {record.notes && (
            <>
              <dt className={dtClass}>{t('notes')}</dt>
              <dd className='whitespace-pre-line'>{record.notes}</dd>
            </>
          )}
        </dl>
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-medium'>{t('steps')}</h2>
        <Steps steps={tenant.steps} />
      </section>

      <EditRecordSheet open={editing} onOpenChange={setEditing} tenant={tenant} />
    </div>
  )
}
