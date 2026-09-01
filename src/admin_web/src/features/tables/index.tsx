import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Armchair, Loader2, MoreHorizontal, Plus, QrCode } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

/** Tables are a flat managed list with almost no content each, so they read as
 *  a floor of small tiles rather than a sparse grid of large cards. The only
 *  live signal they carry is whether an order is waiting on one. */
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

  const busyCount = tablesWithOpenOrders.size

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
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className='h-[88px] w-full rounded-xl' />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
              <Armchair className='text-muted-foreground/40 h-8 w-8' />
              <p className='text-muted-foreground'>{t('noTablesYet')}</p>
              <Button onClick={openAdd} variant='outline'>
                <Plus className='me-2 h-4 w-4' />
                {t('addTable')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {busyCount > 0 && (
              <p className='text-muted-foreground mb-3 text-sm'>
                {t('tablesWithOpenOrders', { count: busyCount })}
              </p>
            )}

            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
              {tables.map((table) => {
                const hasOpenOrder = tablesWithOpenOrders.has(Number(table.id))
                return (
                  <Card
                    key={table.id}
                    className={cn(
                      'relative transition-colors',
                      hasOpenOrder && 'border-amber-500/60 bg-amber-500/5',
                      !table.isActive && 'border-dashed opacity-70'
                    )}
                  >
                    <CardContent className='flex flex-col gap-2 p-4'>
                      <div className='flex items-start justify-between gap-1'>
                        <Armchair
                          className={cn(
                            'h-5 w-5 shrink-0',
                            hasOpenOrder
                              ? 'text-amber-600 dark:text-amber-500'
                              : 'text-muted-foreground'
                          )}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='-me-2 -mt-2 size-8'
                              aria-label={t('actions')}
                            >
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => openEdit(table)}>
                              {t('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyQrLink(table)}>
                              {t('copyTableLink')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleActive(table)}
                            >
                              {t(
                                table.isActive
                                  ? 'deactivateTable'
                                  : 'activateTable'
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant='destructive'
                              onClick={() => setPendingDelete(table)}
                            >
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className='truncate font-medium'>
                        {localized(table.name)}
                      </div>

                      {hasOpenOrder ? (
                        <Badge className='w-fit border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'>
                          {t('openOrder')}
                        </Badge>
                      ) : !table.isActive ? (
                        <Badge variant='secondary' className='w-fit'>
                          {t('tableInactive')}
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
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
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
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
