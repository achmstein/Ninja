import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import {
  getPlatformOptions,
  listTenantsOptions,
} from '@/api/control/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KindBadge, StatusBadge } from '@/components/tenant-badges'
import { useFormat } from '@/lib/format'
import { useLanguage, useT } from '@/lib/i18n'
import { isBusy, tenantKind, tenantStatus } from '@/lib/tenant'

/**
 * Every tenant, newest first. The list keeps itself fresh while any stack
 * is mid-change; otherwise it is as static as the platform is.
 */
export function TenantsPage() {
  const t = useT()
  const format = useFormat()
  const language = useLanguage((s) => s.language)
  const platform = useQuery(getPlatformOptions())
  const tenants = useQuery({
    ...listTenantsOptions(),
    refetchInterval: (query) =>
      query.state.data?.some((x) => isBusy(tenantStatus(x.status)))
        ? 10_000
        : false,
  })

  const rows = tenants.data ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <h1 className='text-2xl font-bold tracking-tight'>{t('tenants')}</h1>
        {platform.data && (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
            <span>
              {t('domain')}{' '}
              <span className='text-foreground font-medium'>
                {platform.data.domain}
              </span>
            </span>
            <span>
              {t('running')}{' '}
              <span className='text-foreground font-medium tabular-nums'>
                {platform.data.running} / {platform.data.total}
              </span>
            </span>
            {platform.data.dryRun && (
              <Badge
                variant='outline'
                className='border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400'
              >
                {t('dryRun')}
              </Badge>
            )}
          </div>
        )}
        <Button asChild className='ms-auto'>
          <Link to='/new'>
            <Plus className='size-4' />
            {t('newTenant')}
          </Link>
        </Button>
      </div>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('slug')}</TableHead>
              <TableHead>{t('kind')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('customerUrl')}</TableHead>
              <TableHead>{t('expires')}</TableHead>
              <TableHead>{t('lastError')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className='h-5 w-full' />
                  </TableCell>
                </TableRow>
              ))}
            {!tenants.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('noTenants')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((tenant) => {
              const name =
                (language === 'ar' ? tenant.nameAr : tenant.nameEn) ||
                tenant.nameEn
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
                  <TableCell>
                    <StatusBadge status={tenant.status} />
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
    </div>
  )
}
