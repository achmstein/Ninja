import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowUpCircle, Mail, MailX, Plus } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { TenantSummary, TenantUsage } from '@/api/control'
import {
  fleetUpgradeMutation,
  getPlatformBackupsOptions,
  getPlatformCapacityOptions,
  getPlatformJobsOptions,
  getPlatformMailOptions,
  getPlatformOptions,
  listTenantsOptions,
  listTenantsQueryKey,
} from '@/api/control/@tanstack/react-query.gen'
import { FleetUpgradeDialog } from '@/features/tenants/dialogs'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { KindBadge, StatusBadge, SubscriptionBadge, UpdateBadge } from '@/components/tenant-badges'
import { megabytes, useFormat } from '@/lib/format'
import { useLanguage, useT } from '@/lib/i18n'
import { isBusy, planLabelKey, subscriptionStatus, tenantKind, tenantStatus } from '@/lib/tenant'
import { AuditTable } from './audit-table'
import { CapacityStrip } from './capacity-strip'
import { CapacityTable } from './capacity-table'
import { PlatformBackups } from './platform-backups'
import { QueueSummary, QueueTable } from './queue-table'

const route = getRouteApi('/_authenticated/')

type Tab = 'tenants' | 'queue' | 'capacity' | 'backups' | 'audit'

/**
 * The platform in one page: the box's headroom always in view, then the
 * tenants, the per-stack usage and the audit trail as tabs in the URL.
 */
export function PlatformPage() {
  const t = useT()
  const format = useFormat()
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const [fleet, setFleet] = useState(false)
  const fleetUpgrade = useMutation({
    ...fleetUpgradeMutation(),
    onSuccess: (r) => {
      toast.success(t('fleetUpgradeQueued', { count: r.queued }))
      setFleet(false)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const platform = useQuery({
    ...getPlatformOptions(),
    refetchInterval: 30_000,
  })
  const capacity = useQuery({
    ...getPlatformCapacityOptions({ query: { refresh: false } }),
    refetchInterval: 30_000,
  })
  // Only the stale flag is read here; the tab shows the rest
  const platformBackups = useQuery({ ...getPlatformBackupsOptions(), refetchInterval: 60_000 })
  const mail = useQuery({ ...getPlatformMailOptions(), refetchInterval: 60_000 })
  // What the lanes are on, always in view: a stamp in flight explains a tenant that reads "Upgrading"
  const jobs = useQuery({ ...getPlatformJobsOptions({ query: { take: 1 } }), refetchInterval: 10_000 })
  // The list keeps itself fresh while any stack is mid-change; otherwise
  // it is as static as the platform is.
  const tenants = useQuery({
    ...listTenantsOptions(),
    refetchInterval: (query) =>
      query.state.data?.some((x) => isBusy(tenantStatus(x.status)))
        ? 10_000
        : false,
  })

  const language = useLanguage((s) => s.language)
  const running = (tenants.data ?? []).filter((x) => tenantStatus(x.status) === 'Running')
  // Destroyed tenants are history: off the list unless asked for
  const [showDestroyed, setShowDestroyed] = useState(false)
  const listed = (tenants.data ?? []).filter((x) => showDestroyed || tenantStatus(x.status) !== 'Destroyed')
  const destroyedCount = (tenants.data ?? []).length - (tenants.data ?? []).filter((x) => tenantStatus(x.status) !== 'Destroyed').length
  const behindCount = (tenants.data ?? []).filter((x) => x.update?.behind).length

  return (
    <div className='flex flex-col gap-4'>
      <PageHeader
        title={t('tenants')}
        badge={
          <>
            {platform.data?.dryRun && (
              <Badge
                variant='outline'
                className='border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400'
              >
                {t('dryRun')}
              </Badge>
            )}
            {behindCount > 0 && (
              <Badge variant='outline' className='border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400'>
                {t('behindCount', { count: behindCount })}
              </Badge>
            )}
          </>
        }
        actions={
          <>
          <Button variant='outline' onClick={() => setFleet(true)} disabled={!tenants.data?.some((x) => tenantStatus(x.status) === 'Running')}>
            <ArrowUpCircle className='size-4' />
            {t('upgradeAll')}
          </Button>
          <Button asChild>
            <Link to='/new'>
              <Plus className='size-4' />
              {t('newTenant')}
            </Link>
          </Button>
          </>
        }
      />

      <FleetUpgradeDialog
        open={fleet}
        onOpenChange={setFleet}
        isPending={fleetUpgrade.isPending}
        tenants={running.map((x) => ({
          slug: x.slug,
          name: (language === 'ar' ? x.nameAr : x.nameEn) || x.nameEn,
          behind: x.update?.behind ?? false,
        }))}
        onConfirm={(imageTag, canary, slugs) => fleetUpgrade.mutate({ body: { imageTag, canary, slugs } })}
      />

      <CapacityStrip capacity={capacity.data} loading={capacity.isLoading} />

      <QueueSummary lanes={jobs.data?.lanes} />

      {mail.data && (
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm'>
          {mail.data.configured ? <Mail className='size-3.5' /> : <MailX className='size-3.5' />}
          {mail.data.configured ? (
            <>
              <span>{t('mailConfigured', { host: mail.data.host ?? '' })}</span>
              <span>·</span>
              <span>{mail.data.lastSentAt ? t('lastSent', { time: format.dateTime(mail.data.lastSentAt) }) : t('nothingSentYet')}</span>
              {mail.data.lastError && <span className='text-destructive'>· {mail.data.lastError}</span>}
            </>
          ) : (
            <span>{t('mailNotConfigured')}</span>
          )}
        </div>
      )}

      {/* What the watchdog found and has not seen clear: one line each, red, until it clears */}
      {platform.data && platform.data.warnings.length > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('platformWarnings', { count: platform.data.warnings.length })}</AlertTitle>
          <AlertDescription>
            <ul className='list-disc ps-4'>
              {platform.data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {platformBackups.data?.stale && !platform.data?.dryRun && (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('platformBackupStale')}</AlertTitle>
          <AlertDescription>{t('platformBackupStaleNote')}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({ search: { tab: v as Tab }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value='tenants'>{t('tabTenants')}</TabsTrigger>
          <TabsTrigger value='queue'>{t('tabQueue')}</TabsTrigger>
          <TabsTrigger value='capacity'>{t('tabCapacity')}</TabsTrigger>
          <TabsTrigger value='backups'>{t('tabBackups')}</TabsTrigger>
          <TabsTrigger value='audit'>{t('tabAudit')}</TabsTrigger>
        </TabsList>
        <TabsContent value='tenants'>
          {destroyedCount > 0 && (
            <div className='mb-3 flex items-center justify-end gap-2'>
              <Switch id='show-destroyed' checked={showDestroyed} onCheckedChange={setShowDestroyed} />
              <Label htmlFor='show-destroyed' className='text-muted-foreground text-sm'>
                {t('showDestroyed')} ({destroyedCount})
              </Label>
            </div>
          )}
          <TenantsTable
            tenants={listed}
            usage={capacity.data?.tenants ?? []}
            loading={tenants.isLoading}
          />
        </TabsContent>
        <TabsContent value='queue'>
          <QueueTable />
        </TabsContent>
        <TabsContent value='capacity'>
          <CapacityTable
            capacity={capacity.data}
            loading={capacity.isLoading}
          />
        </TabsContent>
        <TabsContent value='backups'>
          <PlatformBackups />
        </TabsContent>
        <TabsContent value='audit'>
          <AuditTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const COLUMNS = 9

type TenantsTableProps = {
  tenants: TenantSummary[]
  /** Per-stack usage from the capacity snapshot, matched by slug */
  usage: TenantUsage[]
  loading: boolean
}

/** Every tenant, newest first, with what its stack takes in memory. */
function TenantsTable({ tenants, usage, loading }: TenantsTableProps) {
  const t = useT()
  const format = useFormat()
  const language = useLanguage((s) => s.language)

  const memoryBySlug = new Map(
    usage.filter((u) => u.slug).map((u) => [u.slug, Number(u.memoryMb)])
  )

  if (!loading && tenants.length === 0) {
    return (
      <Empty className='border'>
        <EmptyHeader>
          <EmptyTitle>{t('noTenants')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('name')}</TableHead>
            <TableHead>{t('slug')}</TableHead>
            <TableHead>{t('kind')}</TableHead>
            <TableHead>{t('plan')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('memory')}</TableHead>
            <TableHead>{t('customerUrl')}</TableHead>
            <TableHead>{t('expiresOrPaidThrough')}</TableHead>
            <TableHead>{t('lastError')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={COLUMNS}>
                  <Skeleton className='h-5 w-full' />
                </TableCell>
              </TableRow>
            ))}
          {tenants.map((tenant) => {
            const name =
              (language === 'ar' ? tenant.nameAr : tenant.nameEn) ||
              tenant.nameEn
            const memory = memoryBySlug.get(tenant.slug)
            return (
              <TableRow key={tenant.slug}>
                <TableCell className='font-medium'>
                  <Link
                    to='/t/$slug'
                    params={{ slug: tenant.slug }}
                    className='inline-flex items-center gap-2 hover:underline'
                  >
                    {/* The café's mark on a white tile, the way its app icon is cut; the initial until a stack serves one */}
                    <Avatar className='rounded-md bg-white ring-1 ring-border'>
                      <AvatarImage src={tenant.logoUrl ?? undefined} alt='' className='object-contain p-0.5' />
                      <AvatarFallback className='rounded-md bg-muted font-semibold'>
                        {name.trim().charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {name}
                  </Link>
                </TableCell>
                <TableCell className='text-muted-foreground font-mono text-xs'>
                  {tenant.slug}
                </TableCell>
                <TableCell>
                  <KindBadge kind={tenant.kind} isDrill={tenant.isDrill} />
                </TableCell>
                <TableCell className='text-xs'>
                  {t(planLabelKey[tenant.plan])}
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1'>
                    <StatusBadge status={tenant.status} />
                    {/* Quiet while the money is fine; a word when it is not */}
                    {!['Active', 'Trialing'].includes(subscriptionStatus(tenant.subscription)) && <SubscriptionBadge status={tenant.subscription} />}
                    {tenant.update?.behind && <UpdateBadge services={tenant.update.services} newerTag={tenant.update.newerTag} />}
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground text-xs tabular-nums'>
                  {memory !== undefined ? megabytes(memory) : ''}
                </TableCell>
                <TableCell>
                  <a
                    href={tenant.customerUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='text-muted-foreground hover:text-foreground text-xs hover:underline'
                  >
                    {tenant.customerUrl.replace(/^https?:\/\//, '')}
                  </a>
                </TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {tenantKind(tenant.kind) === 'Demo'
                    ? format.date(tenant.expiresAt)
                    : format.date(tenant.paidThrough)}
                </TableCell>
                <TableCell
                  className='text-destructive max-w-64 truncate text-xs'
                  title={tenant.lastError ?? undefined}
                >
                  {tenant.lastError}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
