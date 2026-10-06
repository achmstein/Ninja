import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  dismissPaymentAttentionMutation,
  listPaymentsNeedingAttentionOptions,
  listPaymentsNeedingAttentionQueryKey,
  markPaymentMoveDoneMutation,
  retryPaymentMoveMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { PaymentAttentionView } from '@/api/sales/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SettingsCard } from '@/components/kit'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'

const listQuery = { query: { 'api-version': API_VERSION } }

const MOVES: Record<string, TranslationKey> = {
  Capture: 'payMoveCapture',
  Void: 'payMoveVoid',
  Refund: 'payMoveRefund',
  None: 'payMoveNone',
}

function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  return (e.response?.data as { detail?: string } | undefined)?.detail
}

/**
 * Online payments waiting on the owner, above the settings: money Paymob
 * would not move (a hold to charge or release, a refund) or its records
 * differing from ours. Each says what is owed and why, with what can be done
 * from here: try again, say it was done in Paymob's dashboard, or put away a
 * difference once seen to. Nothing at all when nothing waits.
 */
export function PaymentsAttention() {
  const t = useT()
  const query = useQuery({
    ...listPaymentsNeedingAttentionOptions(listQuery),
    // A retry in the background may clear one
    refetchInterval: 60_000,
  })
  const rows = query.data ?? []
  if (rows.length === 0) return null

  return (
    <SettingsCard
      className='ring-warning/40 mb-6 ring-1'
      title={
        <span className='flex items-center gap-2'>
          <AlertTriangle className='text-warning size-4' />
          {t('payAttentionTitle')}
          <StatusChip tone='warning'>{rows.length}</StatusChip>
        </span>
      }
      description={t('payAttentionHint')}
    >
      {rows.map((row) => (
        <AttentionRow key={row.key} row={row} />
      ))}
    </SettingsCard>
  )
}

function AttentionRow({ row }: { row: PaymentAttentionView }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [confirmDone, setConfirmDone] = useState(false)
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: listPaymentsNeedingAttentionQueryKey(listQuery),
    })
  const path = { path: { key: row.key }, ...listQuery }
  const owed = row.move !== 'None'

  const retry = useMutation({
    ...retryPaymentMoveMutation(),
    onSuccess: (after) => {
      if (after.move === 'None') toast.success(t('payAttentionDone'))
      else toast.error(after.problem || t('payAttentionStillFailing'))
      refresh()
    },
    onError: (e) => toast.error(problemDetail(e) || t('payAttentionStillFailing')),
  })
  const done = useMutation({
    ...markPaymentMoveDoneMutation(),
    onSuccess: () => {
      toast.success(t('payAttentionDone'))
      setConfirmDone(false)
      refresh()
    },
    onError: (e) => toast.error(problemDetail(e) || t('payAttentionStillFailing')),
  })
  const dismiss = useMutation({
    ...dismissPaymentAttentionMutation(),
    onSuccess: refresh,
    onError: (e) => toast.error(problemDetail(e) || t('payAttentionStillFailing')),
  })
  const busy = retry.isPending || done.isPending || dismiss.isPending

  const what =
    row.orderId != null
      ? t('payAttentionOrder', { id: String(row.orderId) })
      : row.ticketId != null
        ? t('payAttentionBill', { id: String(row.ticketId) })
        : row.payerName

  return (
    <div className='grid gap-3 px-5 py-4'>
      <ListRow
        title={
          <span className='flex items-center gap-2'>
            <StatusChip tone={owed ? 'warning' : 'info'}>
              {t(MOVES[row.move] ?? 'payMoveNone')}
            </StatusChip>
            <span className='truncate'>{what}</span>
          </span>
        }
        meta={
          <>
            {row.payerName && row.orderId != null && (
              <>
                <span>{row.payerName}</span>
                <Dot />
              </>
            )}
            <When value={row.attentionSince} />
            {owed && toNumber(row.attempts) > 0 && (
              <>
                <Dot />
                <span>{t('payAttentionTries', { count: toNumber(row.attempts) })}</span>
              </>
            )}
            {row.nextTryAt && (
              <>
                <Dot />
                <span>
                  {t('payAttentionNextTry')} <When value={row.nextTryAt} />
                </span>
              </>
            )}
            {row.transactionId && (
              <>
                <Dot />
                <span dir='ltr' className='font-mono'>
                  {row.transactionId}
                </span>
              </>
            )}
          </>
        }
        trailing={<Money value={row.charged} />}
      />
      {row.problem && (
        <p className='bg-muted/60 rounded-md px-3 py-2 text-sm'>{row.problem}</p>
      )}
      <div className='flex flex-wrap justify-end gap-2'>
        {owed ? (
          <>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={busy}
              onClick={() => setConfirmDone(true)}
            >
              {t('payMarkDone')}
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={busy}
              onClick={() => retry.mutate(path)}
            >
              {retry.isPending && <Spinner />}
              {t('payRetryNow')}
            </Button>
          </>
        ) : (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={busy}
            onClick={() => dismiss.mutate(path)}
          >
            {dismiss.isPending && <Spinner />}
            {t('payDismiss')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDone}
        onOpenChange={setConfirmDone}
        title={t('payMarkDone')}
        desc={t('payMarkDoneConfirm')}
        confirmText={t('payMarkDone')}
        isLoading={done.isPending}
        handleConfirm={() => done.mutate(path)}
      />
    </div>
  )
}
