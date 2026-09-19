import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Archive, Download, History, Trash2 } from 'lucide-react'
import type { BackupInfo, TenantDetail } from '@/api/control'
import {
  createTenantBackupMutation,
  deleteTenantBackupMutation,
  listTenantBackupsOptions,
  listTenantBackupsQueryKey,
  listTenantsQueryKey,
  restoreTenantBackupMutation,
} from '@/api/control/@tanstack/react-query.gen'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { canBackup, isValidSlug, tenantStatus } from '@/lib/tenant'
import { toast } from '@/lib/toast'

/**
 * The nightly archives and any taken by hand: download one, restore one
 * into a fresh tenant, or drop one.
 */
export function BackupsTab({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const slug = tenant.slug
  const status = tenantStatus(tenant.status)

  const [restoring, setRestoring] = useState<BackupInfo | null>(null)
  const [deleting, setDeleting] = useState<BackupInfo | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const listKey = listTenantBackupsQueryKey({ path: { slug } })
  const backups = useQuery({
    ...listTenantBackupsOptions({ path: { slug } }),
    refetchOnWindowFocus: 'always',
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey })
  const failed = (e: unknown) => toast.error(problemDetail(e) || t('somethingWentWrong'))

  const create = useMutation({
    ...createTenantBackupMutation(),
    onSuccess: () => {
      toast.success(t('backupQueued'))
      // The archive is written in the background; a moment later it is listed
      setTimeout(invalidate, 2_000)
    },
    onError: failed,
  })
  const remove = useMutation({
    ...deleteTenantBackupMutation(),
    onSuccess: () => {
      toast.success(t('backupDeleted'))
      setDeleting(null)
      invalidate()
    },
    onError: failed,
  })

  // A plain link would not carry the bearer token: fetch the archive
  // through the shared client and hand the browser a blob
  const download = async (backup: BackupInfo) => {
    setDownloading(backup.id)
    try {
      const res = await apiClient.get<Blob>(
        `/api/control/tenants/${encodeURIComponent(slug)}/backups/${encodeURIComponent(backup.id)}/download`,
        { responseType: 'blob' }
      )
      const disposition = String(res.headers['content-disposition'] ?? '')
      const named = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1]
      const filename = named ? decodeURIComponent(named) : `${slug}-${backup.id}.tar.gz`
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      failed(e)
    } finally {
      setDownloading(null)
    }
  }

  const rows = backups.data ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-muted-foreground text-sm'>{t('nightly')}</span>
        {canBackup(status) && (
          <Button size='sm' disabled={create.isPending} onClick={() => create.mutate({ path: { slug } })}>
            {create.isPending ? <Spinner /> : <Archive />}
            {t('createBackup')}
          </Button>
        )}
      </div>

      {backups.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Archive />
            </EmptyMedia>
            <EmptyTitle>{t('noBackups')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('at')}</TableHead>
                <TableHead className='text-end'>{t('size')}</TableHead>
                <TableHead className='text-end'>{t('uploads')}</TableHead>
                <TableHead>{t('imageTag')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className='font-medium'>{format.dateTime(b.at)}</div>
                    <div className='text-muted-foreground font-mono text-xs' dir='ltr'>
                      {b.id}
                    </div>
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    <div>{megabytes(Number(b.sizeBytes) / 1024 / 1024)}</div>
                    <div className='text-muted-foreground text-xs'>
                      {b.databases.length} DB
                    </div>
                  </TableCell>
                  <TableCell className='text-end'>{b.hasUploads ? t('yes') : t('no')}</TableCell>
                  <TableCell className='font-mono text-xs' dir='ltr'>
                    {b.imageTag}
                  </TableCell>
                  <TableCell className='text-end'>
                    <div className='flex justify-end gap-1'>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-8'
                            aria-label={t('restore')}
                            onClick={() => setRestoring(b)}
                          >
                            <History />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('restore')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='text-destructive size-8'
                            aria-label={t('deleteBackup')}
                            onClick={() => setDeleting(b)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('deleteBackup')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RestoreDialog
        slug={slug}
        backup={restoring}
        onOpenChange={(v) => !v && setRestoring(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBackup')}</AlertDialogTitle>
            <AlertDialogDescription className='font-mono text-xs' dir='ltr'>
              {deleting?.id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (deleting) remove.mutate({ path: { slug, id: deleting.id } })
              }}
            >
              {remove.isPending && <Spinner />}
              {t('deleteBackup')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Restore into a brand-new tenant: its slug, and optionally a name and owner. */
function RestoreDialog({
  slug,
  backup,
  onOpenChange,
}: {
  slug: string
  backup: BackupInfo | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [intoSlug, setIntoSlug] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  const restore = useMutation({
    ...restoreTenantBackupMutation(),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      toast.success(t('restoreQueued'))
      onOpenChange(false)
      navigate({ to: '/t/$slug', params: { slug: created.slug } })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const slugOk = isValidSlug(intoSlug)
  const emailOk = ownerEmail.trim() === '' || ownerEmail.includes('@')
  const canSubmit = slugOk && emailOk && !restore.isPending

  return (
    <AlertDialog
      open={backup !== null}
      onOpenChange={(v) => {
        if (!v) {
          setIntoSlug('')
          setNameEn('')
          setOwnerEmail('')
        }
        onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('restoreTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('restoreNote')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='restore-slug'>{t('restoreInto')}</Label>
            <Input
              id='restore-slug'
              value={intoSlug}
              onChange={(e) => setIntoSlug(e.target.value.toLowerCase())}
              aria-invalid={intoSlug !== '' && !slugOk}
              className='font-mono'
              dir='ltr'
              autoComplete='off'
              autoFocus
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='restore-name'>
              {t('nameEn')}
              <span className='text-muted-foreground font-normal'>{t('optional')}</span>
            </Label>
            <Input id='restore-name' value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='restore-owner'>
              {t('ownerEmail')}
              <span className='text-muted-foreground font-normal'>{t('optional')}</span>
            </Label>
            <Input
              id='restore-owner'
              type='email'
              dir='ltr'
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              aria-invalid={!emailOk}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restore.isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSubmit}
            onClick={(e) => {
              e.preventDefault()
              if (!backup) return
              restore.mutate({
                path: { slug, id: backup.id },
                body: {
                  intoSlug,
                  nameEn: nameEn.trim() || null,
                  ownerEmail: ownerEmail.trim() || null,
                },
              })
            }}
          >
            {restore.isPending && <Spinner />}
            {t('restore')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
