import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, Trash2, Upload } from 'lucide-react'
import { type ExpenseView } from '@/api/finance'
import { apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { pickedReceipt, RECEIPT_ACCEPT } from '../receipts'
import { useFinanceActions } from '../use-finance-actions'

/**
 * The paperclip on an expense row: filled when a bill is attached (tap to
 * see it), hollow when not (tap to pick a photo or a PDF).
 */
export function ReceiptButton({
  expense,
  onView,
}: {
  expense: ExpenseView
  onView: () => void
}) {
  const t = useT()
  const { attachReceipt, isPending } = useFinanceActions()
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        className={cn(
          'size-8',
          expense.hasReceipt ? 'text-primary' : 'text-muted-foreground'
        )}
        aria-label={expense.hasReceipt ? t('viewReceipt') : t('attachReceipt')}
        title={expense.hasReceipt ? t('viewReceipt') : t('attachReceipt')}
        disabled={isPending}
        onClick={() => (expense.hasReceipt ? onView() : input.current?.click())}
      >
        <Paperclip className='h-4 w-4' />
      </Button>
      <input
        ref={input}
        type='file'
        accept={RECEIPT_ACCEPT}
        className='hidden'
        onChange={(e) => {
          const file = pickedReceipt(e, t('receiptTooLarge'))
          if (file) {
            void attachReceipt(toNumber(expense.id), file).catch(() => {
              // toasted by useFinanceActions
            })
          }
        }}
      />
    </>
  )
}

/**
 * The attached bill, shown as it was uploaded: a photo inline, a PDF in a
 * frame. Replace it with another file, or take it off.
 */
export function ReceiptDialog({
  expense,
  onClose,
}: {
  expense: ExpenseView | null
  onClose: () => void
}) {
  return (
    <Dialog open={expense !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-2xl'>
        {expense && (
          <ReceiptViewer
            key={String(expense.id)}
            expense={expense}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptViewer({
  expense,
  onClose,
}: {
  expense: ExpenseView
  onClose: () => void
}) {
  const t = useT()
  const id = toNumber(expense.id)
  const { attachReceipt, removeReceipt, isPending } = useFinanceActions()
  const input = useRef<HTMLInputElement>(null)

  // The file itself comes through the same axios client (token, branch),
  // as a blob the browser shows from an object URL. Not cached: the URL
  // is revoked when the viewer closes
  const receipt = useQuery({
    queryKey: [{ _id: 'getExpenseReceipt', id }],
    queryFn: async () => {
      const { data, headers } = await apiClient.get<Blob>(
        `/api/finance/expenses/${id}/receipt`,
        { responseType: 'blob' }
      )
      return {
        url: URL.createObjectURL(data),
        type: String(headers['content-type'] ?? data.type),
      }
    },
    staleTime: Infinity,
    gcTime: 0,
  })

  const objectUrl = receipt.data?.url ?? null
  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  const isPdf = receipt.data?.type.includes('pdf') ?? false

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('receiptOfExpense')}</DialogTitle>
        <DialogDescription>
          {[expense.vendor, expense.note].filter(Boolean).join(' · ') ||
            expense.date}
        </DialogDescription>
      </DialogHeader>

      {receipt.isLoading || !objectUrl ? (
        <Skeleton className='h-80' />
      ) : receipt.isError ? (
        <p className='text-destructive text-sm'>{t('receiptMissing')}</p>
      ) : isPdf ? (
        <iframe
          title={t('receiptOfExpense')}
          src={objectUrl}
          className='h-[70svh] w-full rounded-md border'
        />
      ) : (
        <img
          src={objectUrl}
          alt={t('receiptOfExpense')}
          className='max-h-[70svh] w-full rounded-md border object-contain'
        />
      )}

      <input
        ref={input}
        type='file'
        accept={RECEIPT_ACCEPT}
        className='hidden'
        onChange={(e) => {
          const file = pickedReceipt(e, t('receiptTooLarge'))
          if (file) {
            void attachReceipt(id, file)
              .then(() => receipt.refetch())
              .catch(() => {
                // toasted by useFinanceActions
              })
          }
        }}
      />

      <DialogFooter className='sm:justify-between'>
        <Button
          type='button'
          variant='ghost'
          className='text-destructive'
          disabled={isPending}
          onClick={() =>
            void removeReceipt(id)
              .then(onClose)
              .catch(() => {
                // toasted by useFinanceActions
              })
          }
        >
          <Trash2 className='me-2 h-4 w-4' />
          {t('removeReceipt')}
        </Button>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={isPending}
            onClick={() => input.current?.click()}
          >
            {isPending ? (
              <Spinner className='me-2' />
            ) : (
              <Upload className='me-2 h-4 w-4' />
            )}
            {t('replaceReceipt')}
          </Button>
          <Button type='button' onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
