import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { listAuditOptions } from '@/api/control/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const TAKES = ['50', '200', '500'] as const
type Take = (typeof TAKES)[number]

const DETAILS_LENGTH = 80

/** Details are JSON on the wire; pretty when they parse, verbatim when not. */
function pretty(details: string): string {
  try {
    return JSON.stringify(JSON.parse(details), null, 2)
  } catch {
    return details
  }
}

type AuditTableProps = {
  /** Only this tenant's entries; the slug column goes with it */
  slug?: string
}

/**
 * Every platform action, newest first: the whole platform on the dashboard,
 * one tenant on its page. Polls while in view so a stamp in progress shows
 * up without a reload.
 */
export function AuditTable({ slug }: AuditTableProps) {
  const t = useT()
  const format = useFormat()
  const [take, setTake] = useState<Take>('50')
  const audit = useQuery({
    ...listAuditOptions({ query: { slug, take: Number(take) } }),
    refetchInterval: 15_000,
  })

  const rows = audit.data ?? []
  const columns = slug ? 5 : 6

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-sm'>{t('showCount')}</span>
        <Select value={take} onValueChange={(v) => setTake(v as Take)}>
          <SelectTrigger size='sm' aria-label={t('showCount')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAKES.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant='ghost'
          size='sm'
          className='ms-auto'
          onClick={() => audit.refetch()}
          disabled={audit.isFetching}
          aria-label={t('refresh')}
        >
          <RefreshCw
            className={cn('size-4', audit.isFetching && 'animate-spin')}
          />
          {t('refresh')}
        </Button>
      </div>

      {!audit.isLoading && rows.length === 0 ? (
        <Empty className='border'>
          <EmptyHeader>
            <EmptyTitle>{t('noAudit')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('at')}</TableHead>
                <TableHead>{t('actor')}</TableHead>
                <TableHead>{t('source')}</TableHead>
                <TableHead>{t('action')}</TableHead>
                {!slug && <TableHead>{t('slug')}</TableHead>}
                <TableHead>{t('detail')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns}>
                      <Skeleton className='h-5 w-full' />
                    </TableCell>
                  </TableRow>
                ))}
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                    {format.dateTime(entry.at)}
                  </TableCell>
                  <TableCell className='text-xs'>
                    {entry.actor === 'system'
                      ? t('system')
                      : (entry.actorEmail ?? entry.actor)}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-xs'>
                    {entry.source}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {entry.action}
                  </TableCell>
                  {!slug && (
                    <TableCell className='font-mono text-xs'>
                      {entry.slug && (
                        <Link
                          to='/t/$slug'
                          params={{ slug: entry.slug }}
                          className='hover:underline'
                        >
                          {entry.slug}
                        </Link>
                      )}
                    </TableCell>
                  )}
                  <TableCell className='text-muted-foreground max-w-80 font-mono text-xs'>
                    {entry.details && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='block truncate'>
                            {entry.details.length > DETAILS_LENGTH
                              ? `${entry.details.slice(0, DETAILS_LENGTH)}…`
                              : entry.details}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className='max-w-96'>
                          <pre
                            dir='ltr'
                            className='max-h-80 overflow-auto text-start font-mono text-xs whitespace-pre-wrap break-all'
                          >
                            {pretty(entry.details)}
                          </pre>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
