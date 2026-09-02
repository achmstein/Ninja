import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ListChecks,
  Loader2,
  Plus,
  Printer,
} from 'lucide-react'
import {
  getTicketOptions,
  moveTicketLinesMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptSheet, type ReceiptPayment } from '@/features/receipt/receipt-sheet'
import { getRealmRoles } from '@/config/oidc-config'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { AddLineDialog } from './add-line-dialog'
import { SettleDialog, type SettleOutcome } from './settle-dialog'
import { VoidTicketDialog } from './void-dialog'

function LineRow({
  line,
  selecting,
  selected,
  onToggle,
}: {
  line: TicketLineView
  selecting: boolean
  selected: boolean
  onToggle: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  const isNegative = toNumber(line.total) < 0
  const discount = toNumber(line.discount)

  const content = (
    <>
      {selecting && (
        <span
          aria-hidden
          className={cn(
            'border-input mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border',
            selected && 'bg-primary text-primary-foreground border-primary'
          )}
        >
          {selected && <Check className='size-4' />}
        </span>
      )}
      <div className='min-w-0 flex-1'>
        <div
          className={cn(
            'truncate text-base font-medium',
            isNegative && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {localized(line.description)}
        </div>
        {localized(line.details) && (
          <div className='text-muted-foreground truncate text-sm'>
            {localized(line.details)}
          </div>
        )}
        <div className='text-muted-foreground text-sm tabular-nums'>
          {toNumber(line.qty)} × {money(line.unitPrice)}
          {discount > 0 && (
            <span> − {money(discount)} ({t('discount')})</span>
          )}
        </div>
      </div>
      <div
        className={cn(
          'shrink-0 text-lg font-semibold tabular-nums',
          isNegative && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {money(line.total)}
      </div>
    </>
  )

  if (selecting) {
    return (
      <button
        type='button'
        onClick={onToggle}
        className={cn(
          'flex min-h-12 w-full items-start gap-3 rounded-lg px-3 py-2 text-start',
          selected ? 'bg-accent' : 'hover:bg-accent/50'
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <div className='flex min-h-12 items-start gap-3 px-3 py-2'>{content}</div>
  )
}

export function TicketScreen({
  ticketId,
  autoSettle = false,
}: {
  ticketId: number
  autoSettle?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()

  const [addLineOpen, setAddLineOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [settleOutcome, setSettleOutcome] = useState<SettleOutcome | null>(null)

  // Voiding is Owner-only (the server enforces the same rule)
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  const { data: ticket, isLoading } = useQuery({
    ...getTicketOptions({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
    }),
    // Poll fallback in case the SignalR connection is silently dead
    refetchInterval: 20_000,
  })

  // Arriving from the sale pad (?settle): the walk-in is standing at the
  // till, so jump straight into taking payment. Once only, and only after
  // the ticket is known to still be open.
  const autoSettleConsumed = useRef(false)
  useEffect(() => {
    if (!autoSettle || autoSettleConsumed.current || !ticket) return
    autoSettleConsumed.current = true
    if (ticket.status !== 'Settled' && ticket.voidedAt == null) {
      setSettleOpen(true)
    }
  }, [autoSettle, ticket])

  const moveLines = useMutation({
    ...moveTicketLinesMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      toast.success(t('linesMoved'))
      setSelecting(false)
      setSelectedIds(new Set())
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  if (isLoading) {
    return (
      <div className='mx-auto flex max-w-3xl flex-col gap-3 p-4'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className='flex flex-col items-center gap-4 py-24'>
        <p className='text-muted-foreground text-lg'>{t('ticketNotFound')}</p>
        <Button asChild size='lg'>
          <Link to='/'>{t('backToFloor')}</Link>
        </Button>
      </div>
    )
  }

  const isSettled = ticket.status === 'Settled'
  // Keyed on voidedAt rather than the status string so a voided ticket
  // renders its tombstone even if the status enum ever gains states
  const isVoided = ticket.voidedAt != null
  const lines = ticket.lines ?? []
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft
  const location = localized(ticket.locationName)

  const toggleLine = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelecting = () => {
    setSelecting((prev) => !prev)
    setSelectedIds(new Set())
  }

  const doMoveLines = () =>
    moveLines.mutate({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
      body: { lineIds: Array.from(selectedIds) },
    })

  // What the printed receipt shows right after settling, before the
  // refetched (settled) ticket lands
  const paymentsOverride: ReceiptPayment[] | undefined =
    settleOutcome && !ticket.settledAt ? settleOutcome.payments : undefined

  return (
    <div className='mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col p-4 pb-28'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-xl font-bold'>
            {t('ticketNumber', { id: toNumber(ticket.id) })}
            {location && (
              <span className='text-muted-foreground font-medium'>
                {' '}· {location}
              </span>
            )}
          </h1>
          {ticket.customerName && (
            <p className='text-muted-foreground truncate text-sm'>
              {ticket.customerName}
            </p>
          )}
        </div>
        {isSettled ? (
          <Badge className='h-8 px-3 text-sm' variant='secondary'>
            {t('settledBadge')}
            {ticket.receiptNumber != null &&
              ` · ${t('receiptNumber', { number: toNumber(ticket.receiptNumber) })}`}
          </Badge>
        ) : isVoided ? (
          <Badge className='h-8 px-3 text-sm' variant='destructive'>
            {t('voidedBadge')}
          </Badge>
        ) : (
          <div className='flex gap-1'>
            <Button
              variant='outline'
              className='h-12 gap-2 px-3'
              onClick={() => setAddLineOpen(true)}
            >
              <Plus className='size-5' />
              <span className='hidden sm:inline'>{t('addLine')}</span>
            </Button>
            <Button
              variant={selecting ? 'secondary' : 'outline'}
              className='h-12 gap-2 px-3'
              disabled={lines.length === 0}
              onClick={toggleSelecting}
            >
              <ListChecks className='size-5' />
              <span className='hidden sm:inline'>{t('selectLines')}</span>
            </Button>
            {/* Owner-only, and deliberately up here — far from the Settle
                button in the bottom bar, so it can't be fat-fingered */}
            {isOwner && (
              <Button
                variant='outline'
                className='text-destructive hover:text-destructive h-12 gap-2 px-3'
                onClick={() => setVoidOpen(true)}
              >
                <Ban className='size-5' />
                <span className='hidden sm:inline'>{t('voidTicket')}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator className='my-3' />

      {lines.length === 0 ? (
        <p className='text-muted-foreground py-16 text-center'>
          {t('emptyTicket')}
        </p>
      ) : (
        <div className='flex flex-col divide-y'>
          {lines.map((line) => (
            <LineRow
              key={String(line.id)}
              line={line}
              selecting={selecting && !isSettled}
              selected={selectedIds.has(toNumber(line.id))}
              onToggle={() => toggleLine(toNumber(line.id))}
            />
          ))}
        </div>
      )}

      {/* A voided ticket keeps its lines for the record but loses every
          action — what remains is the audit trail */}
      {isVoided && (
        <div className='border-destructive/30 bg-destructive/5 mt-4 rounded-xl border p-4'>
          <div className='text-destructive flex items-center gap-2 font-semibold'>
            <Ban className='size-5' />
            {t('voidedBadge')}
          </div>
          {ticket.voidReason && (
            <p className='mt-2 text-base'>{ticket.voidReason}</p>
          )}
          <p className='text-muted-foreground mt-1 text-sm'>
            {ticket.voidedBy && <span>{t('voidedBy')}: {ticket.voidedBy}</span>}
            {ticket.voidedAt && (
              <span className='tabular-nums'>
                {' '}·{' '}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(ticket.voidedAt))}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Sticky action bar: the running total is always in reach, and so is
          the primary action (Settle, or Move while selecting) */}
      {!isVoided && (
      <div className='bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur'>
        <div className='mx-auto flex max-w-3xl items-center gap-4'>
          <div>
            <div className='text-muted-foreground text-sm'>{t('total')}</div>
            <div className='text-2xl font-bold tabular-nums'>
              {money(ticket.total)}
            </div>
          </div>
          <div className='ms-auto'>
            {isSettled ? (
              <Button
                size='lg'
                className='h-14 px-6 text-lg'
                onClick={() => window.print()}
              >
                <Printer className='size-5' />
                {t('print')}
              </Button>
            ) : selecting ? (
              <Button
                size='lg'
                className='h-14 px-6 text-lg'
                disabled={selectedIds.size === 0 || moveLines.isPending}
                onClick={doMoveLines}
              >
                {moveLines.isPending && (
                  <Loader2 className='size-5 animate-spin' />
                )}
                {t('moveLinesAction', { count: selectedIds.size })}
              </Button>
            ) : (
              <Button
                size='lg'
                className='h-14 px-8 text-lg'
                disabled={lines.length === 0}
                onClick={() => setSettleOpen(true)}
              >
                {t('settleAction')}
              </Button>
            )}
          </div>
        </div>
      </div>
      )}

      <AddLineDialog
        ticketId={ticketId}
        open={addLineOpen}
        onOpenChange={setAddLineOpen}
      />
      <SettleDialog
        ticket={ticket}
        open={settleOpen}
        onOpenChange={setSettleOpen}
        onSettled={setSettleOutcome}
      />
      <VoidTicketDialog
        ticketId={ticketId}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
      {(isSettled || settleOutcome) && (
        <ReceiptSheet
          ticket={ticket}
          paymentsOverride={paymentsOverride}
          receiptNumberOverride={settleOutcome?.receiptNumber}
        />
      )}
    </div>
  )
}
