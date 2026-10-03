import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, Trash2, Upload } from 'lucide-react'
import { type ExpenseView } from '@/api/finance'
import { apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
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
  const t = useT()
  return (
    <EntitySheet
      open={expense !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('receiptOfExpense')}
      subtitle={
        expense
          ? [expense.vendor, expense.note].filter(Boolean).join(' · ') ||
            expense.date
          : undefined
      }
      size='wide'
    >
      {expense && (
        <ReceiptViewer
          key={String(expense.id)}
          expense={expense}
          onClose={onClose}
        />
      )}
    </EntitySheet>
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

      <SheetActions side='start'>
        <Button
          type='button'
          variant='ghost'
          className='text-destructive hover:text-destructive'
          disabled={isPending}
          onClick={() =>
            void removeReceipt(id)
              .then(onClose)
              .catch(() => {
                // toasted by useFinanceActions
              })
          }
        >
          <Trash2 />
          {t('removeReceipt')}
        </Button>
      </SheetActions>
      <SheetActions>
        <Button
          type='button'
          variant='outline'
          disabled={isPending}
          onClick={() => input.current?.click()}
        >
          {isPending ? <Spinner /> : <Upload />}
          {t('replaceReceipt')}
        </Button>
        <Button type='button' onClick={onClose}>
          {t('close')}
        </Button>
      </SheetActions>
    </>
  )
}
