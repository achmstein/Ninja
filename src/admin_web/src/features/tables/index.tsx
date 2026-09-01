import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Armchair, Copy, Loader2, Pencil, Plus, QrCode, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type TableViewModel } from '@/api/spaces'
import {
  deleteTableMutation,
  listTablesOptions,
  setTableActiveMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TableDialog } from './components/table-dialog'
import { tableQrUrl } from './qr'

/** Tables are a flat managed list: no sessions or live status of their own, so
 *  the only live signal worth showing is whether an order is waiting on one. */
export function TablesManagement() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<TableViewModel | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TableViewModel | null>(null)

  const { data: tables = [], isLoading } = useQuery(listTablesOptions())

  const { data: pendingOrders = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR order events are the primary update path; this poll is a fallback
    refetchInterval: 60_000,
  })

  // Which tables currently have an order waiting to be prepared
  const tablesWithOpenOrders = useMemo(
    () =>
      new Set(
        pendingOrders
          .map((o) => o.tableId)
          .filter((id): id is number => id != null)
      ),
    [pendingOrders]
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listTables' }] })

  const setActive = useMutation(setTableActiveMutation())
  const remove = useMutation(deleteTableMutation())

  const toggleActive = async (table: TableViewModel) => {
    try {
      await setActive.mutateAsync({
        path: { id: Number(table.id) },
        body: { isActive: !table.isActive },
      })
      invalidate()
      toast.success(t('tableUpdated'))
    } catch {
      toast.error(t('failedToSaveTable'))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await remove.mutateAsync({ path: { id: Number(pendingDelete.id) } })
      invalidate()
      toast.success(t('tableDeleted'))
      setPendingDelete(null)
    } catch {
      toast.error(t('failedToDeleteTable'))
    }
  }

  const copyQrLink = (table: TableViewModel) => {
    navigator.clipboard.writeText(tableQrUrl(Number(table.id)))
    toast.success(t('tableLinkCopied'))
  }

  // Prefill the next table's name so adding a row of them is just save, save, save
  const suggestedName = useMemo(() => {
    const next = tables.length + 1
    return { en: `Table ${next}`, ar: `ترابيزة ${next}` }
  }, [tables.length])

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (table: TableViewModel) => {
    setEditing(table)
    setDialogOpen(true)
  }

  return (
    <>
      <Header />

      <Main>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{t('tables')}</h1>
            <p className='text-muted-foreground'>{t('tablesSubtitle')}</p>
          </div>

          <div className='flex items-center gap-2'>
            <Button variant='outline' asChild>
              <Link to='/tables/print'>
                <QrCode className='me-2 h-4 w-4' />
                {t('printQrSheet')}
              </Link>
            </Button>
            <Button onClick={openAdd}>
              <Plus className='me-2 h-4 w-4' />
              {t('addTable')}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-24 w-full' />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>
            {t('noTablesYet')}
          </p>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {tables.map((table) => {
              const hasOpenOrder = tablesWithOpenOrders.has(Number(table.id))
              return (
                <div
                  key={table.id}
                  className={cn(
                    'bg-card flex items-start justify-between gap-3 rounded-lg border p-4',
                    !table.isActive && 'opacity-60'
                  )}
                >
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <Armchair className='text-muted-foreground h-4 w-4 shrink-0' />
                      <span className='truncate font-medium'>
                        {localized(table.name)}
                      </span>
                    </div>

                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      {hasOpenOrder && (
                        <span className='inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400'>
                          <span className='h-1.5 w-1.5 rounded-full bg-amber-500' />
                          {t('openOrder')}
                        </span>
                      )}
                      {!table.isActive && (
                        <span className='text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs'>
                          {t('tableInactive')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className='flex shrink-0 items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => copyQrLink(table)}
                      title={t('copyTableLink')}
                    >
                      <Copy className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => openEdit(table)}
                      title={t('edit')}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => toggleActive(table)}
                    >
                      {t(table.isActive ? 'deactivateTable' : 'activateTable')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setPendingDelete(table)}
                      title={t('delete')}
                    >
                      <Trash2 className='text-destructive h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Main>

      {dialogOpen && (
        <TableDialog
          table={editing}
          open
          suggestedName={suggestedName}
          onOpenChange={setDialogOpen}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTableQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTableConfirmation', {
                name: pendingDelete ? localized(pendingDelete.name) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending && (
                <Loader2 className='me-2 h-4 w-4 animate-spin' />
              )}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
