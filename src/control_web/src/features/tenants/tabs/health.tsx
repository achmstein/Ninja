import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Server } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import {
  getTenantContainersOptions,
  getTenantHealthOptions,
  getTenantLogsOptions,
} from '@/api/control/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/i18n'
import { isStamped, tenantStatus } from '@/lib/tenant'
import { cn } from '@/lib/utils'

const ALL = '__all__'
const TAILS = [100, 500, 2000] as const

/**
 * What docker says about each container, what each service says about
 * itself through the gateway, and the tail of their logs.
 */
export function HealthTab({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const status = tenantStatus(tenant.status)
  const stamped = isStamped(status)
  const slug = tenant.slug

  const containers = useQuery({
    ...getTenantContainersOptions({ path: { slug } }),
    enabled: stamped,
    refetchInterval: 15_000,
  })
  const health = useQuery({
    ...getTenantHealthOptions({ path: { slug } }),
    enabled: status === 'Running',
    refetchInterval: 15_000,
  })

  if (!stamped) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Server />
          </EmptyMedia>
          <EmptyTitle>{t('noStack')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-6'>
      {health.data && health.data.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {health.data.map((h) => (
            <Tooltip key={h.service}>
              <TooltipTrigger asChild>
                <Badge
                  variant='outline'
                  className={cn(
                    'gap-1.5 border-transparent',
                    h.ok
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-destructive/15 text-destructive'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('size-1.5 rounded-full', h.ok ? 'bg-emerald-500' : 'bg-destructive')}
                  />
                  {h.service}
                </Badge>
              </TooltipTrigger>
              <TooltipContent dir='ltr' className='font-mono text-xs'>
                {Number(h.ms)} ms{h.detail ? ` · ${h.detail}` : ''}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('service')}</TableHead>
              <TableHead>{t('state')}</TableHead>
              <TableHead>{t('health')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('image')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className='h-5 w-full' />
                  </TableCell>
                </TableRow>
              ))}
            {!containers.isLoading && (containers.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground h-24 text-center'>
                  {t('noStack')}
                </TableCell>
              </TableRow>
            )}
            {containers.data?.map((c) => (
              <TableRow key={c.name}>
                <TableCell className='font-medium'>{c.service}</TableCell>
                <TableCell>
                  <Badge variant={c.state === 'running' ? 'default' : 'destructive'}>
                    {c.state}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground'>{c.health ?? '—'}</TableCell>
                <TableCell className='text-muted-foreground' dir='ltr'>
                  {c.status}
                </TableCell>
                <TableCell className='max-w-[14rem]'>
                  {c.image ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='block truncate font-mono text-xs' dir='ltr'>
                          {c.image}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent dir='ltr' className='font-mono text-xs'>
                        {c.image}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Logs slug={slug} sources={[...tenant.services, 'gateway']} />
    </div>
  )
}

/** The services the plan stamps and the gateway have a log; a plan change can take the chosen one away, which reads as every service again. */
function Logs({ slug, sources }: { slug: string; sources: string[] }) {
  const t = useT()
  const [chosen, setService] = useState<string>(ALL)
  const service = chosen !== ALL && !sources.includes(chosen) ? ALL : chosen
  const [tail, setTail] = useState<number>(500)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)

  // The endpoint answers text/plain: the generated client leaves the data
  // untyped, so it is asked for text and narrowed here
  const logs = useQuery({
    ...getTenantLogsOptions({
      path: { slug },
      query: { service: service === ALL ? undefined : service, tail },
      responseType: 'text',
    }),
    refetchInterval: autoRefresh ? 5_000 : false,
  })
  const text = typeof logs.data === 'string' ? logs.data : ''

  useEffect(() => {
    const el = viewport.current?.querySelector<HTMLElement>('[data-slot=scroll-area-viewport]')
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className='w-44' aria-label={t('service')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allServices')}</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(tail)} onValueChange={(v) => setTail(Number(v))}>
          <SelectTrigger className='w-28' aria-label={t('tail')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAILS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className='flex items-center gap-2'>
          <Switch id='logs-auto' checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Label htmlFor='logs-auto'>{t('autoRefresh')}</Label>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='ms-auto size-8'
          aria-label={t('refresh')}
          disabled={logs.isFetching}
          onClick={() => logs.refetch()}
        >
          <RefreshCw className={cn(logs.isFetching && 'animate-spin')} />
        </Button>
      </div>
      <ScrollArea ref={viewport} className='bg-muted/30 h-[28rem] rounded-lg border'>
        {logs.isLoading ? (
          <div className='flex flex-col gap-2 p-3'>
            <Skeleton className='h-3 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
            <Skeleton className='h-3 w-2/3' />
          </div>
        ) : text.trim() === '' ? (
          <p className='text-muted-foreground p-3 text-sm'>{t('noLogs')}</p>
        ) : (
          <pre dir='ltr' className='p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap'>
            {text}
          </pre>
        )}
      </ScrollArea>
    </div>
  )
}
