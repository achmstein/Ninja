import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Play,
  RotateCw,
  Square,
  Trash2,
  ArrowUpCircle,
  CalendarPlus,
} from 'lucide-react'
import {
  destroyTenantMutation,
  extendDemoMutation,
  getTenantOptions,
  getTenantQueryKey,
  listTenantsQueryKey,
  provisionTenantMutation,
  startTenantMutation,
  stopTenantMutation,
  upgradeTenantMutation,
} from '@/api/control/@tanstack/react-query.gen'
import type { TenantDetail } from '@/api/control'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import { KindBadge, StatusBadge } from '@/components/tenant-badges'
import { useFormat } from '@/lib/format'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import {
  canDestroy,
  canProvision,
  canStart,
  canStop,
  canUpgrade,
  isBusy,
  tenantKind,
  tenantStatus,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'
import { DestroyDialog, ExtendDialog, UpgradeDialog } from './dialogs'
import { Steps } from './steps'

const HOSTS: { key: keyof TenantDetail['hosts']; label: TranslationKey }[] = [
  { key: 'customer', label: 'hostCustomer' },
  { key: 'admin', label: 'hostAdmin' },
  { key: 'pos', label: 'hostPos' },
  { key: 'kds', label: 'hostKds' },
  { key: 'api', label: 'hostApi' },
]

/**
 * One tenant: where it is, where it lives, who owns it, what the last run
 * did, and the actions its status allows. Polls while the stack is moving.
 */
export function TenantPage({ slug }: { slug: string }) {
  const t = useT()
  const format = useFormat()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const query = useQuery({
    ...getTenantOptions({ path: { slug } }),
    refetchInterval: (q) =>
      q.state.data && isBusy(tenantStatus(q.state.data.status)) ? 5_000 : false,
  })

  const [dialog, setDialog] = useState<'extend' | 'upgrade' | 'destroy' | null>(
    null
  )

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getTenantQueryKey({ path: { slug } }) })
    queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
  }
  const queued = () => {
    toast.success(t('actionQueued'))
    setDialog(null)
    refresh()
  }
  const failed = (e: unknown) =>
    toast.error(problemDetail(e) || t('somethingWentWrong'))

  const provision = useMutation({ ...provisionTenantMutation(), onSuccess: queued, onError: failed })
  const stop = useMutation({ ...stopTenantMutation(), onSuccess: queued, onError: failed })
  const start = useMutation({ ...startTenantMutation(), onSuccess: queued, onError: failed })
  const upgrade = useMutation({ ...upgradeTenantMutation(), onSuccess: queued, onError: failed })
  const destroy = useMutation({ ...destroyTenantMutation(), onSuccess: queued, onError: failed })
  const extend = useMutation({
    ...extendDemoMutation(),
    onSuccess: (detail) => {
      queryClient.setQueryData(getTenantQueryKey({ path: { slug } }), detail)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('extended'))
      setDialog(null)
    },
    onError: failed,
  })

  if (query.isLoading) {
    return (
      <div className='flex items-center justify-center py-24'>
        <Loader2 className='size-8 animate-spin' />
      </div>
    )
  }

  const tenant = query.data
  if (!tenant) {
    const notFound =
      query.error instanceof AxiosError && query.error.response?.status === 404
    return (
      <div className='flex flex-col items-center justify-center gap-4 py-24'>
        <h1 className='text-2xl font-bold'>
          {notFound ? t('notFound') : t('somethingWentWrong')}
        </h1>
        <Button asChild variant='outline'>
          <Link to='/'>{t('backToTenants')}</Link>
        </Button>
      </div>
    )
  }

  const status = tenantStatus(tenant.status)
  const kind = tenantKind(tenant.kind)
  const name = (language === 'ar' ? tenant.nameAr : tenant.nameEn) || tenant.nameEn
  const busy =
    isBusy(status) ||
    provision.isPending ||
    stop.isPending ||
    start.isPending ||
    upgrade.isPending ||
    destroy.isPending
  const path = { path: { slug } }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='-ms-2 size-9'>
          <Link to='/' aria-label={t('backToTenants')}>
            <ArrowLeft className='rtl:rotate-180' />
          </Link>
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>{name}</h1>
        <StatusBadge status={tenant.status} />
        <KindBadge kind={tenant.kind} />
        <span className='text-muted-foreground font-mono text-xs'>{tenant.slug}</span>

        <div className='ms-auto flex flex-wrap items-center gap-2'>
          {canProvision(status) && (
            <Button
              size='sm'
              disabled={busy}
              onClick={() => provision.mutate(path)}
            >
              {status === 'Failed' ? <RotateCw className='size-4' /> : <Play className='size-4' />}
              {status === 'Failed' ? t('retryProvision') : t('provision')}
            </Button>
          )}
          {canStop(status) && (
            <Button size='sm' variant='outline' disabled={busy} onClick={() => stop.mutate(path)}>
              <Square className='size-4' />
              {t('stop')}
            </Button>
          )}
          {canStart(status) && (
            <Button size='sm' disabled={busy} onClick={() => start.mutate(path)}>
              <Play className='size-4' />
              {t('start')}
            </Button>
          )}
          {canUpgrade(status) && (
            <Button size='sm' variant='outline' disabled={busy} onClick={() => setDialog('upgrade')}>
              <ArrowUpCircle className='size-4' />
              {t('upgrade')}
            </Button>
          )}
          {canDestroy(status) && (
            <Button size='sm' variant='destructive' disabled={busy} onClick={() => setDialog('destroy')}>
              <Trash2 className='size-4' />
              {t('destroy')}
            </Button>
          )}
        </div>
      </div>

      {tenant.lastError && status === 'Failed' && (
        <p className='text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm'>
          {tenant.lastError}
        </p>
      )}

      <section className='grid gap-x-8 gap-y-6 md:grid-cols-2'>
        <dl className='grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm'>
          <dt className='text-muted-foreground'>{t('hosts')}</dt>
          <dd className='flex flex-col gap-1'>
            {HOSTS.map(({ key, label }) => (
              <a
                key={key}
                href={tenant.hosts[key]}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1.5 hover:underline'
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

        <dl className='grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm'>
          <dt className='text-muted-foreground'>{t('owner')}</dt>
          <dd className='flex items-center gap-1'>
            <span className='truncate' dir='ltr'>{tenant.ownerEmail}</span>
            <CopyButton value={tenant.ownerEmail} />
          </dd>
          {tenant.ownerInitialPassword && (
            <>
              <dt className='text-muted-foreground'>{t('initialPassword')}</dt>
              <dd className='flex items-center gap-1'>
                <span className='font-mono' dir='ltr'>{tenant.ownerInitialPassword}</span>
                <CopyButton value={tenant.ownerInitialPassword} />
              </dd>
            </>
          )}
          {kind === 'Demo' && (
            <>
              <dt className='text-muted-foreground'>{t('expires')}</dt>
              <dd className='flex items-center gap-2'>
                <span>{format.dateTime(tenant.expiresAt) || '—'}</span>
                {status !== 'Destroyed' && status !== 'Destroying' && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2'
                    onClick={() => setDialog('extend')}
                  >
                    <CalendarPlus className='size-4' />
                    {t('extend')}
                  </Button>
                )}
              </dd>
            </>
          )}
          <dt className='text-muted-foreground'>{t('imageTag')}</dt>
          <dd className='font-mono' dir='ltr'>{tenant.imageTag}</dd>
          <dt className='text-muted-foreground'>{t('created')}</dt>
          <dd>{format.dateTime(tenant.createdAt)}</dd>
          {tenant.provisionedAt && (
            <>
              <dt className='text-muted-foreground'>{t('provisioned')}</dt>
              <dd>{format.dateTime(tenant.provisionedAt)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-medium'>{t('steps')}</h2>
        <Steps steps={tenant.steps} />
      </section>

      <ExtendDialog
        open={dialog === 'extend'}
        onOpenChange={(v) => setDialog(v ? 'extend' : null)}
        isPending={extend.isPending}
        onConfirm={(days) => extend.mutate({ ...path, body: { days } })}
      />
      <UpgradeDialog
        open={dialog === 'upgrade'}
        onOpenChange={(v) => setDialog(v ? 'upgrade' : null)}
        isPending={upgrade.isPending}
        currentTag={tenant.imageTag}
        onConfirm={(imageTag) =>
          upgrade.mutate({ ...path, body: imageTag ? { imageTag } : null })
        }
      />
      <DestroyDialog
        open={dialog === 'destroy'}
        onOpenChange={(v) => setDialog(v ? 'destroy' : null)}
        isPending={destroy.isPending}
        slug={tenant.slug}
        name={name}
        onConfirm={() => destroy.mutate(path)}
      />
    </div>
  )
}
