import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import type { CapacityResponse } from '@/api/control'
import {
  getPlatformCapacityOptions,
  getPlatformCapacityQueryKey,
} from '@/api/control/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { megabytes, percent, useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type CapacityTableProps = {
  capacity: CapacityResponse | undefined
  loading: boolean
}

/**
 * Every compose project on the box and what it takes, the platform's own
 * included. The snapshot is what the API last read; the refresh button
 * asks for a fresh one and hands it to every reader of the cached query.
 */
export function CapacityTable({ capacity, loading }: CapacityTableProps) {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()

  const refresh = useMutation({
    mutationFn: async () => {
      const fresh = await queryClient.fetchQuery({
        ...getPlatformCapacityOptions({ query: { refresh: true } }),
        staleTime: 0,
      })
      queryClient.setQueryData(
        getPlatformCapacityQueryKey({ query: { refresh: false } }),
        fresh
      )
      await queryClient.invalidateQueries({
        queryKey: getPlatformCapacityQueryKey(),
      })
    },
  })

  const rows = capacity?.tenants ?? []
  const footprint = Number(capacity?.stackFootprintMb ?? 0)

  return (
    <div className='flex flex-col gap-3'>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
        {capacity && (
          <>
            <span>
              {t('takenAt')}{' '}
              <span className='text-foreground'>
                {format.dateTime(capacity.at)}
              </span>
            </span>
            <span>
              {t('dockerUsed')}{' '}
              <span className='text-foreground tabular-nums'>
                {megabytes(Number(capacity.dockerUsedMb))}
              </span>
              <span className='ms-1'>
                ({megabytes(Number(capacity.dockerReclaimableMb))}{' '}
                {t('reclaimable')})
              </span>
            </span>
          </>
        )}
        <Button
          variant='ghost'
          size='sm'
          className='ms-auto'
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label={t('refresh')}
        >
          <RefreshCw
            className={cn('size-4', refresh.isPending && 'animate-spin')}
          />
          {t('refresh')}
        </Button>
      </div>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('containers')}</TableHead>
              <TableHead>{t('memory')}</TableHead>
              <TableHead>{t('cpu')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className='h-5 w-full' />
                  </TableCell>
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('none')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((usage) => {
              const memory = Number(usage.memoryMb)
              return (
                <TableRow key={usage.project}>
                  <TableCell className='font-medium'>
                    {usage.slug ? (
                      <Link
                        to='/t/$slug'
                        params={{ slug: usage.slug }}
                        className='hover:underline'
                      >
                        {usage.project}
                      </Link>
                    ) : (
                      <span className='flex items-center gap-2'>
                        {usage.project}
                        <Badge variant='outline'>{t('platformItself')}</Badge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {Number(usage.running)} / {Number(usage.containers)}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <span className='w-16 tabular-nums'>
                        {megabytes(memory)}
                      </span>
                      <Progress
                        value={percent(memory, footprint)}
                        className='h-1.5 w-24 rtl:-scale-x-100'
                      />
                    </div>
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {Number(usage.cpuPercent).toFixed(1)}%
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
