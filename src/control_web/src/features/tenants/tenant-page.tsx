import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import {
  AlertCircle,
  ArrowUpCircle,
  CalendarPlus,
  KeyRound,
  LogIn,
  Mail,
  MoreHorizontal,
  Play,
  RotateCw,
  Square,
  Trash2,
  Undo2,
  UserCheck,
} from 'lucide-react'
import {
  convertTenantMutation,
  destroyTenantMutation,
  forgetTenantMutation,
  dismissTenantErrorMutation,
  extendDemoMutation,
  getTenantOptions,
  getTenantQueryKey,
  impersonateOwnerMutation,
  listTenantsQueryKey,
  provisionTenantMutation,
  resendWelcomeEmailMutation,
  resumeTenantMutation,
  rollbackTenantMutation,
  secureTenantMutation,
  startTenantMutation,
  stopTenantMutation,
  upgradeTenantMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { PageHeader } from '@/components/page-header'
import { KindBadge, StatusBadge, SubscriptionBadge, UpdateBadge } from '@/components/tenant-badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import {
  canConvert,
  canDestroy,
  canForget,
  canImpersonate,
  canProvision,
  canResume,
  canSecure,
  canStart,
  canStop,
  canUpgrade,
  isBusy,
  isStamped,
  planLabelKey,
  subscriptionStatus,
  tenantKind,
  tenantStatus,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'
import { ConvertDialog, DestroyDialog, ExtendDialog, ForgetDialog, RollbackDialog, RotateDialog, UpgradeDialog } from './dialogs'
import { AuditTab } from './tabs/audit'
import { SubscriptionTab } from './tabs/subscription'
import { BackupsTab } from './tabs/backups'
import { HealthTab } from './tabs/health'
import { OverviewTab } from './tabs/overview'
import { JobLabel } from '@/features/platform/queue-table'

// Recharts and the brand editor only load once their tab opens
const BrandTab = lazy(() => import('./tabs/brand').then((m) => ({ default: m.BrandTab })))
const MetricsTab = lazy(() => import('./tabs/metrics').then((m) => ({ default: m.MetricsTab })))

export const TENANT_TABS = ['overview', 'brand', 'subscription', 'health', 'metrics', 'backups', 'audit'] as const
export type TenantTab = (typeof TENANT_TABS)[number]

const TAB_LABELS: Record<TenantTab, TranslationKey> = {
  overview: 'tabOverview',
  brand: 'tabBrand',
  subscription: 'tabSubscription',
  health: 'tabHealth',
  metrics: 'tabMetrics',
  backups: 'tabBackups',
  audit: 'tabAudit',
}

type OpenDialog = 'extend' | 'upgrade' | 'destroy' | 'forget' | 'convert' | 'rotate' | 'rollback' | null

function Loading() {
  return (
    <div className='flex items-center justify-center py-24'>
      <Spinner className='size-8' />
    </div>
  )
}

/**
 * One tenant: its name, state and the actions its status allows on top;
 * the rest behind tabs the URL remembers. Polls while the stack is moving.
 */
export function TenantPage({ slug, tab }: { slug: string; tab: TenantTab }) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const query = useQuery({
    ...getTenantOptions({ path: { slug } }),
    // While the stack moves, and while a job waits to move it: an upgrade is
    // Running when queued, Upgrading a few seconds later and Running again
    // twenty seconds after that; polling on the status alone shows none of it
    refetchInterval: (q) => {
      const d = q.state.data
      return d && (isBusy(tenantStatus(d.status)) || d.jobs.length > 0) ? 3_000 : false
    },
  })

  const [dialog, setDialog] = useState<OpenDialog>(null)

  const tenantKey = getTenantQueryKey({ path: { slug } })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: tenantKey })
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
  const secure = useMutation({ ...secureTenantMutation(), onSuccess: queued, onError: failed })
  const resume = useMutation({ ...resumeTenantMutation(), onSuccess: queued, onError: failed })
  const rollback = useMutation({ ...rollbackTenantMutation(), onSuccess: queued, onError: failed })
  const dismiss = useMutation({ ...dismissTenantErrorMutation(), onSuccess: refresh, onError: failed })
  const resendWelcome = useMutation({
    ...resendWelcomeEmailMutation(),
    onSuccess: () => {
      toast.success(t('welcomeQueued'))
      refresh()
    },
    onError: failed,
  })
  const destroy = useMutation({ ...destroyTenantMutation(), onSuccess: queued, onError: failed })
  // The record is gone: back to the list, which no longer has it
  const forget = useMutation({
    ...forgetTenantMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('forgotten'))
      navigate({ to: '/' })
    },
    onError: failed,
  })
  const extend = useMutation({
    ...extendDemoMutation(),
    onSuccess: (detail) => {
      queryClient.setQueryData(tenantKey, detail)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('extended'))
      setDialog(null)
    },
    onError: failed,
  })
  const convert = useMutation({
    ...convertTenantMutation(),
    onSuccess: (detail) => {
      queryClient.setQueryData(tenantKey, detail)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('converted'))
      setDialog(null)
    },
    onError: failed,
  })
  const impersonate = useMutation(impersonateOwnerMutation())

  // The tab is opened before the call, while the click is still a user
  // gesture; otherwise popup blockers eat it. The link then lands in it.
  const signInAsOwner = async () => {
    const w = window.open('', '_blank')
    try {
      const link = await impersonate.mutateAsync({ path: { slug } })
      if (w) w.location.href = link.url
      else window.open(link.url, '_blank')
    } catch (e) {
      w?.close()
      toast.error(problemDetail(e) || t('signInLinkFailed'))
    }
  }

  if (query.isLoading) return <Loading />

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
  const name = tenant.nameEn || tenant.nameAr || tenant.slug
  const busy =
    isBusy(status) ||
    tenant.jobs.some((j) => j.lane === 'Stamp') ||
    provision.isPending ||
    stop.isPending ||
    start.isPending ||
    upgrade.isPending ||
    secure.isPending ||
    destroy.isPending
  const path = { path: { slug } }
  const alive = status !== 'Destroying' && status !== 'Destroyed'
  const showMore = (kind === 'Demo' && alive) || canUpgrade(status) || canConvert(kind, status) || canDestroy(status) || canForget(status) || canSecure(status) || canImpersonate(status)

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        back={{ to: '/' }}
        title={name}
        badge={
          <>
            <StatusBadge status={tenant.status} />
            <KindBadge kind={tenant.kind} isDrill={tenant.isDrill} />
            <Badge variant='outline'>{t(planLabelKey[tenant.record.plan])}</Badge>
            {!['Active', 'Trialing'].includes(subscriptionStatus(tenant.subscription.status)) && <SubscriptionBadge status={tenant.subscription.status} />}
            {tenant.update?.behind && <UpdateBadge services={tenant.update.services} newerTag={tenant.update.newerTag} />}
            {tenant.jobs.map((job) => (
              <Badge key={job.id} variant='outline' className='gap-1.5'>
                <Spinner className='size-3' />
                <JobLabel job={job} />
                <span className='text-muted-foreground'>
                  · {job.status === 'Running' ? t('laneRunning') : t('positionInLine', { position: job.position ?? 0 })}
                </span>
              </Badge>
            ))}
            <span className='text-muted-foreground font-mono text-xs' dir='ltr'>
              {tenant.slug}
            </span>
          </>
        }
        actions={
          <>
            {canProvision(status) && (
              <Button size='sm' disabled={busy} onClick={() => provision.mutate(path)}>
                {status === 'Failed' ? <RotateCw /> : <Play />}
                {status === 'Failed' ? t('retryProvision') : t('provision')}
              </Button>
            )}
            {canStop(status) && (
              <Button size='sm' variant='outline' disabled={busy} onClick={() => stop.mutate(path)}>
                <Square />
                {t('stop')}
              </Button>
            )}
            {canStart(status) && (
              <Button size='sm' disabled={busy} onClick={() => start.mutate(path)}>
                <Play />
                {t('start')}
              </Button>
            )}
            {canResume(status) && (
              <Button size='sm' disabled={busy || resume.isPending} onClick={() => resume.mutate(path)}>
                <Play />
                {t('resume')}
              </Button>
            )}
            {/* Behind: the upgrade is a button, not a menu item */}
            {tenant.update?.behind && canUpgrade(status) && (
              <Button size='sm' disabled={busy} onClick={() => setDialog('upgrade')}>
                <ArrowUpCircle />
                {t('upgrade')}
              </Button>
            )}
            {canImpersonate(status) && (
              <Button
                size='sm'
                variant='outline'
                disabled={impersonate.isPending}
                onClick={signInAsOwner}
              >
                {impersonate.isPending ? <Spinner /> : <LogIn />}
                {t('signInAsOwner')}
              </Button>
            )}
            {showMore && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size='icon' variant='outline' className='size-8' aria-label={t('more')}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {kind === 'Demo' && alive && (
                    <DropdownMenuItem onSelect={() => setDialog('extend')}>
                      <CalendarPlus />
                      {t('extend')}
                    </DropdownMenuItem>
                  )}
                  {canUpgrade(status) && (
                    <DropdownMenuItem disabled={busy} onSelect={() => setDialog('upgrade')}>
                      <ArrowUpCircle />
                      {t('upgrade')}
                    </DropdownMenuItem>
                  )}
                  {tenant.previousImageTag && (status === 'Running' || status === 'Failed') && (
                    <DropdownMenuItem disabled={busy} onSelect={() => setDialog('rollback')}>
                      <Undo2 />
                      {t('rollbackTo', { tag: tenant.previousImageTag })}
                    </DropdownMenuItem>
                  )}
                  {canImpersonate(status) && (
                    <DropdownMenuItem disabled={resendWelcome.isPending} onSelect={() => resendWelcome.mutate(path)}>
                      <Mail />
                      {t('resendWelcome')}
                    </DropdownMenuItem>
                  )}
                  {canSecure(status) && tenant.hasOwnCredentials && (
                    <DropdownMenuItem disabled={busy} onSelect={() => setDialog('rotate')}>
                      <KeyRound />
                      {t('rotateCredentials')}
                    </DropdownMenuItem>
                  )}
                  {canConvert(kind, status) && (
                    <DropdownMenuItem onSelect={() => setDialog('convert')}>
                      <UserCheck />
                      {t('convert')}
                    </DropdownMenuItem>
                  )}
                  {canDestroy(status) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant='destructive'
                        disabled={busy}
                        onSelect={() => setDialog('destroy')}
                      >
                        <Trash2 />
                        {t('destroy')}
                      </DropdownMenuItem>
                    </>
                  )}
                  {canForget(status) && (
                    <DropdownMenuItem
                      variant='destructive'
                      disabled={forget.isPending}
                      onSelect={() => setDialog('forget')}
                    >
                      <Trash2 />
                      {t('forget')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {/* Stamped before tenants had a role and a broker user of their own: on the shared superuser until secured */}
      {!tenant.hasOwnCredentials && isStamped(status) && !isBusy(status) && (
        <Alert className='border-amber-500/40 bg-amber-500/10 [&>svg]:text-amber-600'>
          <KeyRound />
          <AlertTitle>{t('sharedCredentials')}</AlertTitle>
          <AlertDescription className='flex flex-wrap items-center justify-between gap-2'>
            <span>{t('sharedCredentialsNote')}</span>
            <Button size='sm' variant='outline' disabled={busy} onClick={() => secure.mutate({ ...path, query: { rotate: false } })}>
              {t('secureNow')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Running, with a story: an upgrade that did not take and was rolled back. It stays until read. */}
      {tenant.lastError && status === 'Running' && (
        <Alert className='border-amber-500/40 bg-amber-500/10 [&>svg]:text-amber-600'>
          <Undo2 />
          <AlertTitle>{t('rolledBack')}</AlertTitle>
          <AlertDescription className='flex flex-wrap items-center justify-between gap-2'>
            <span className='font-mono text-xs break-all' dir='ltr'>{tenant.lastError}</span>
            <Button size='sm' variant='outline' disabled={busy || dismiss.isPending} onClick={() => dismiss.mutate(path)}>
              {t('dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {tenant.lastError && status === 'Failed' && (
        <Alert variant='destructive'>
          <AlertCircle />
          <AlertTitle>{t('lastError')}</AlertTitle>
          <AlertDescription className='font-mono text-xs break-all' dir='ltr'>
            {tenant.lastError}
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            to: '/t/$slug',
            params: { slug },
            search: { tab: v as TenantTab },
            replace: true,
          })
        }
      >
        {/* The list scrolls sideways on a phone; its wrapper keeps the active
            tab's underline (drawn below the list) inside the scroll box */}
        <div className='max-w-full overflow-x-auto pb-2'>
          <TabsList variant='line'>
            {TENANT_TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(TAB_LABELS[key])}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value='overview' className='pt-2'>
          <OverviewTab tenant={tenant} onExtend={() => setDialog('extend')} />
        </TabsContent>
        <TabsContent value='brand' className='pt-2'>
          <Suspense fallback={<Loading />}>
            <BrandTab tenant={tenant} />
          </Suspense>
        </TabsContent>
        <TabsContent value='subscription' className='pt-2'>
          <SubscriptionTab tenant={tenant} />
        </TabsContent>
        <TabsContent value='health' className='pt-2'>
          <HealthTab tenant={tenant} />
        </TabsContent>
        <TabsContent value='metrics' className='pt-2'>
          <Suspense fallback={<Loading />}>
            <MetricsTab tenant={tenant} />
          </Suspense>
        </TabsContent>
        <TabsContent value='backups' className='pt-2'>
          <BackupsTab tenant={tenant} />
        </TabsContent>
        <TabsContent value='audit' className='pt-2'>
          <AuditTab slug={slug} />
        </TabsContent>
      </Tabs>

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
        update={tenant.update}
        onConfirm={(imageTag) =>
          upgrade.mutate({ ...path, body: imageTag ? { imageTag } : null })
        }
      />
      <ConvertDialog
        open={dialog === 'convert'}
        onOpenChange={(v) => setDialog(v ? 'convert' : null)}
        isPending={convert.isPending}
        name={name}
        currentPlan={tenant.record.plan}
        onConfirm={(plan, paidThrough) => convert.mutate({ ...path, body: { plan, paidThrough: new Date(paidThrough).toISOString() } })}
      />
      <RollbackDialog
        open={dialog === 'rollback'}
        onOpenChange={(v) => setDialog(v ? 'rollback' : null)}
        isPending={rollback.isPending}
        previousTag={tenant.previousImageTag ?? ''}
        backupId={tenant.upgradeBackupId}
        onConfirm={() => rollback.mutate(path)}
      />
      <RotateDialog
        open={dialog === 'rotate'}
        onOpenChange={(v) => setDialog(v ? 'rotate' : null)}
        isPending={secure.isPending}
        name={name}
        onConfirm={() => secure.mutate({ ...path, query: { rotate: true } })}
      />
      <DestroyDialog
        open={dialog === 'destroy'}
        onOpenChange={(v) => setDialog(v ? 'destroy' : null)}
        isPending={destroy.isPending}
        slug={tenant.slug}
        name={name}
        onConfirm={() => destroy.mutate(path)}
      />
      <ForgetDialog
        open={dialog === 'forget'}
        onOpenChange={(v) => setDialog(v ? 'forget' : null)}
        isPending={forget.isPending}
        name={name}
        onConfirm={() => forget.mutate(path)}
      />
    </div>
  )
}
