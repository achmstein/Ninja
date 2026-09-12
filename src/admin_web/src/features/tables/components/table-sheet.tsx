import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Armchair, Link as LinkIcon, Pencil, Trash2 } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { type TableViewModel } from '@/api/spaces'
import {
  deleteTableMutation,
  setTableActiveMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { tableQrUrl } from '@/lib/qr'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PendingOrderCard } from '@/features/orders/components/pending-order-card'
import { useOrderActions } from '@/features/orders/use-order-actions'
import { TableDialog } from './table-dialog'

type TableSheetProps = {
  table: TableViewModel | null
  /** Submitted orders waiting on this table, oldest first */
  orders: OrderSummary[]
  nowMs: number
  suggestedName: { en: string; ar: string }
  onOpenChange: (open: boolean) => void
}

/**
 * Everything about one table, in place: the orders waiting on it (with
 * Confirm right there), then its settings. Deleting asks; toggling doesn't.
 */
export function TableSheet({
  table,
  orders,
  nowMs,
  suggestedName,
  onOpenChange,
}: TableSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { confirm, cancel, actingOrderNumber } = useOrderActions()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listTables' }] })

  const setActive = useMutation({
    ...setTableActiveMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('tableUpdated'))
    },
    onError: () => toast.error(t('failedToSaveTable')),
  })

  const remove = useMutation({
    ...deleteTableMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('tableDeleted'))
      setConfirmDelete(false)
      onOpenChange(false)
    },
    onError: () => toast.error(t('failedToDeleteTable')),
  })

  const copyQrLink = () => {
    if (!table) return
    navigator.clipboard.writeText(tableQrUrl(Number(table.id)))
    toast.success(t('tableLinkCopied'))
  }

  return (
    <>
      <Sheet open={table != null} onOpenChange={onOpenChange}>
        <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-2'>
              <Armchair className='text-muted-foreground size-5' />
              {table ? localized(table.name) : ''}
            </SheetTitle>
            <SheetDescription>
              {orders.length > 0
                ? t('tableOpenOrders', { count: orders.length })
                : t('noOrdersForTable')}
            </SheetDescription>
          </SheetHeader>

          {table && (
            <div className='flex flex-1 flex-col gap-4 px-4 pb-4'>
              {orders.length === 0 ? (
                <EmptyState
                  compact
                  icon={Armchair}
                  title={t('noOrdersForTable')}
                />
              ) : (
                orders.map((order) => (
                  <PendingOrderCard
                    key={String(order.orderNumber)}
                    summary={order}
                    nowMs={nowMs}
                    onConfirm={() => confirm(Number(order.orderNumber))}
                    onCancel={() => setCancelTarget(Number(order.orderNumber))}
                    isActing={
                      Number(actingOrderNumber) === Number(order.orderNumber)
                    }
                  />
                ))
              )}

              <Separator />

              <div className='flex items-center justify-between gap-4'>
                <div>
                  <Label htmlFor='table-active'>
                    {t('tableAcceptingOrders')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {table.isActive ? t('active') : t('tableInactive')}
                  </p>
                </div>
                <Switch
                  id='table-active'
                  checked={!!table.isActive}
                  disabled={setActive.isPending}
                  onCheckedChange={(checked) =>
                    setActive.mutate({
                      path: { id: Number(table.id) },
                      body: { isActive: checked },
                    })
                  }
                />
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button variant='outline' onClick={() => setEditOpen(true)}>
                  <Pencil className='me-1 h-4 w-4' />
                  {t('edit')}
                </Button>
                <Button variant='outline' onClick={copyQrLink}>
                  <LinkIcon className='me-1 h-4 w-4' />
                  {t('copyTableLink')}
                </Button>
                <Button
                  variant='ghost'
                  className='text-destructive hover:text-destructive ms-auto'
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className='me-1 h-4 w-4' />
                  {t('delete')}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editOpen && table && (
        <TableDialog
          table={table}
          open
          suggestedName={suggestedName}
          onOpenChange={setEditOpen}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTableQuestion')}
        desc={t('deleteTableConfirmation', {
          name: table ? localized(table.name) : '',
        })}
        confirmText={t('delete')}
        destructive
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (table) remove.mutate({ path: { id: Number(table.id) } })
        }}
      />

      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        title={t('cancelOrderQuestion')}
        desc={t('cancelOrderConfirmation')}
        cancelBtnText={t('keepOrder')}
        confirmText={t('cancelOrderButton')}
        destructive
        handleConfirm={() => {
          if (cancelTarget != null) cancel(cancelTarget)
          setCancelTarget(null)
        }}
      />
    </>
  )
}
