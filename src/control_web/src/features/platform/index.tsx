import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { TenantSummary, TenantUsage } from '@/api/control'
import {
  getPlatformCapacityOptions,
  getPlatformOptions,
  listTenantsOptions,
} from '@/api/control/@tanstack/react-query.gen'
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
import { KindBadge, StatusBadge } from '@/components/tenant-badges'
import { megabytes, useFormat } from '@/lib/format'
import { useLanguage, useT } from '@/lib/i18n'
import { isBusy, planLabelKey, tenantKind, tenantStatus } from '@/lib/tenant'
import { AuditTable } from './audit-table'
import { CapacityStrip } from './capacity-strip'
import { CapacityTable } from './capacity-table'

const route = getRouteApi('/_authenticated/')

type Tab = 'tenants' | 'capacity' | 'audit'

/**
 * The platform in one page: the box's headroom always in view, then the
 * tenants, the per-stack usage and the audit trail as tabs in the URL.
 */
export function PlatformPage() {
  const t = useT()
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()

  const platform = useQuery({
    ...getPlatformOptions(),
    refetchInterval: 30_000,
  })
  const capacity = useQuery({
    ...getPlatformCapacityOptions({ query: { refresh: false } }),
    refetchInterval: 30_000,
  })
  // The list keeps itself fresh while any stack is mid-change; otherwise
  // it is as static as the platform is.
  const tenants = useQuery({
    ...listTenantsOptions(),
    refetchInterval: (query) =>
      query.state.data?.some((x) => isBusy(tenantStatus(x.status)))
        ? 10_000
        : false,
  })

  return (
    <div className='flex flex-col gap-4'>
      <PageHeader
        title={t('tenants')}
        badge={
          platform.data?.dryRun && (
            <Badge
              variant='outline'
              className='border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400'
            >
              {t('dryRun')}
            </Badge>
          )
        }
        actions={
          <Button asChild>
            <Link to='/new'>
              <Plus className='size-4' />
              {t('newTenant')}
            </Link>
          </Button>
        }
      />

      <CapacityStrip capacity={capacity.data} loading={capacity.isLoading} />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({ search: { tab: v as Tab }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value='tenants'>{t('tabTenants')}</TabsTrigger>
          <TabsTrigger value='capacity'>{t('tabCapacity')}</TabsTrigger>
          <TabsTrigger value='audit'>{t('tabAudit')}</TabsTrigger>
        </TabsList>
        <TabsContent value='tenants'>
          <TenantsTable
            tenants={tenants.data ?? []}
            usage={capacity.data?.tenants ?? []}
            loading={tenants.isLoading}
          />
        </TabsContent>
        <TabsContent value='capacity'>
          <CapacityTable
            capacity={capacity.data}
            loading={capacity.isLoading}
          />
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
            <TableHead>{t('expires')}</TableHead>
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
                    className='hover:underline'
                  >
                    {name}
                  </Link>
                </TableCell>
                <TableCell className='text-muted-foreground font-mono text-xs'>
                  {tenant.slug}
                </TableCell>
                <TableCell>
                  <KindBadge kind={tenant.kind} />
                </TableCell>
                <TableCell className='text-xs'>
                  {t(planLabelKey[tenant.plan])}
                </TableCell>
                <TableCell>
                  <StatusBadge status={tenant.status} />
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
                    : ''}
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
