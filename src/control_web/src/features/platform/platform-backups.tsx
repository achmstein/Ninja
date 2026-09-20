import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Cloud, CloudOff, Download } from 'lucide-react'
import type { BackupInfo } from '@/api/control'
import {
  createPlatformBackupMutation,
  getPlatformBackupsOptions,
  getPlatformBackupsQueryKey,
} from '@/api/control/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { apiClient } from '@/lib/api-client'
import { megabytes, useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'

/**
 * The platform's own backups: controldb and keycloak, nightly before the
 * tenants' and on demand, each copied off the box when there is a bucket.
 * What a dead box must not take with it.
 */
export function PlatformBackups() {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState<string | null>(null)

  const backups = useQuery({ ...getPlatformBackupsOptions(), refetchInterval: 60_000 })
  const create = useMutation({
    ...createPlatformBackupMutation(),
    onSuccess: () => {
      toast.success(t('backupDone'))
      queryClient.invalidateQueries({ queryKey: getPlatformBackupsQueryKey() })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  // A plain link would not carry the bearer token: fetch the archive
  // through the shared client and hand the browser a blob
  const download = async (backup: BackupInfo) => {
    setDownloading(backup.id)
    try {
      const res = await apiClient.get<Blob>(
        `/api/control/platform/backups/${encodeURIComponent(backup.id)}/download`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `platform-${backup.id}.tar.gz`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(problemDetail(e) || t('somethingWentWrong'))
    } finally {
      setDownloading(null)
    }
  }

  const data = backups.data
  const rows = data?.backups ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm'>
          <span>{t('platformBackupsNote')}</span>
          {data && (
            <span className='flex items-center gap-1'>
              {data.offsiteEnabled ? <Cloud className='size-3.5' /> : <CloudOff className='size-3.5' />}
              {data.offsiteEnabled
                ? data.lastOffsiteAt
                  ? t('lastOffsite', { time: format.dateTime(data.lastOffsiteAt) })
                  : t('offsiteNotYet')
                : t('offsiteOff')}
            </span>
          )}
        </div>
        <Button size='sm' disabled={create.isPending} onClick={() => create.mutate({})}>
          {create.isPending ? <Spinner /> : <Archive />}
          {t('createBackup')}
        </Button>
      </div>

      {backups.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Archive />
            </EmptyMedia>
            <EmptyTitle>{t('noPlatformBackups')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('at')}</TableHead>
                <TableHead className='text-end'>{t('size')}</TableHead>
                <TableHead>{t('offsite')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className='font-medium'>{format.dateTime(b.at)}</div>
                    <div className='text-muted-foreground font-mono text-xs' dir='ltr'>
                      {b.id} · {b.databases.join(', ')}
                    </div>
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {megabytes(Number(b.sizeBytes) / 1024 / 1024)}
                  </TableCell>
                  <TableCell>
                    <OffsiteCell at={b.offsiteAt} />
                  </TableCell>
                  <TableCell className='text-end'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-8'
                          aria-label={t('download')}
                          disabled={downloading === b.id}
                          onClick={() => download(b)}
                        >
                          {downloading === b.id ? <Spinner /> : <Download />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('download')}</TooltipContent>
                    </Tooltip>
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

/** When the copy reached the bucket, or a dash while it is only on the box. */
export function OffsiteCell({ at }: { at: string | null | undefined }) {
  const format = useFormat()
  if (!at) return <span className='text-muted-foreground'>—</span>
  return (
    <span className='flex items-center gap-1 text-sm'>
      <Cloud className='text-muted-foreground size-3.5' />
      {format.dateTime(at)}
    </span>
  )
}
