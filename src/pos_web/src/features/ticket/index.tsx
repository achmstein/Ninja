import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BadgePercent,
  Check,
  Clock,
  ListChecks,
  Loader2,
  Printer,
  ShoppingCart,
  Timer,
  Trash2,
  Undo2,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import { assignOrderCustomerMutation } from '@/api/ordering/@tanstack/react-query.gen'
import {
  assignTicketLinesCustomerMutation,
  getTicketOptions,
  moveTicketLinesMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingOrders } from '@/features/orders/pending-orders'
import {
  pendingForTicket,
  usePendingOrders,
} from '@/features/orders/use-pending-orders'
import {
  ReceiptSheet,
  type ReceiptPayment,
} from '@/features/receipt/receipt-sheet'
import { StayBar } from '@/features/places/stay-bar'
import { StayMembers } from '@/features/places/stay-members'
import { isRunning, stayRoster } from '@/features/places/status'
import { TimeSoFar } from '@/features/places/time-so-far'
import { useStay, useStayActions } from '@/features/places/use-places'
import type { SaleCustomer } from '@/features/sale/cart'
import { CustomerDialog } from '@/features/sale/customer-dialog'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getRealmRoles } from '@/config/oidc-config'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { TICKET_TYPE_COUNTER, TICKET_TYPE_TABLE } from '@/lib/ticket-types'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { DiscardTicketDialog } from './discard-dialog'
import { MoveTargetDialog, type MoveTarget } from './move-target-dialog'
import { RefundDialog } from './refund-dialog'
import { SettleDialog, type SettleOutcome } from './settle-dialog'
import { VoidTicketDialog } from './void-dialog'
import { DiscountDialog } from './discount-dialog'
import { KitchenReprintButton } from './kitchen-reprint'
import { BreakdownDialog } from './breakdown-dialog'
import { onlineSummary } from './online-payments'
import { OnlinePaymentsPanel } from './online-payments-panel'
import { useOnlinePayments } from './use-online-payments'

const percent = (rate: number | string | undefined) =>
  Math.round(toNumber(rate) * 10000) / 100

/**
 * A bill reads by item, not by round. Ordering the same thing twice in an
 * evening writes two lines — two orders, two kitchen tickets, two audit rows,
 * all of which stay exactly as they are underneath — but on screen they add
 * up to "Cappuccino 2 ×". Only identical lines merge: same item, same options,
 * same price, same discount, same origin.
 */
function mergeIdenticalLines(lines: TicketLineView[]): TicketLineView[] {
  const merged: TicketLineView[] = []
  const seen = new Map<string, number>()

  for (const line of lines) {
    // JSON rather than a delimiter: no separator can collide with an item
    // name, however it is punctuated
    const key = JSON.stringify([
      line.source,
      line.description?.en ?? '',
      line.description?.ar ?? '',
      line.details?.en ?? '',
      line.unitPrice,
      line.discount,
    ])

    const at = seen.get(key)

    if (at === undefined) {
      seen.set(key, merged.length)
      merged.push({ ...line })
      continue
    }

    merged[at] = {
      ...merged[at],
      qty: toNumber(merged[at].qty) + toNumber(line.qty),
      total: toNumber(merged[at].total) + toNumber(line.total),
    }
  }

  return merged
}

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
  // Session time belongs to the session: it is never offered for a move
  const selectable = selecting && line.source !== 'SessionTime'

  const content = (
    <>
      {selectable && (
        <span
          aria-hidden
          className={cn(
            'border-input mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border',
            selected && 'bg-primary text-primary-foreground border-primary',
          )}
        >
          {selected && <Check className='size-4' />}
        </span>
      )}
      <div className='min-w-0 flex-1'>
        <div
          className={cn(
            'truncate text-base font-medium',
            isNegative && 'text-emerald-600 dark:text-emerald-400',
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
            <span>
              {' '}
              − {money(discount)} ({t('discount')})
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          'shrink-0 text-lg font-semibold tabular-nums',
          isNegative && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {money(line.total)}
      </div>
    </>
  )

  if (selectable) {
    return (
      <button
        type='button'
        onClick={onToggle}
        className={cn(
          'flex min-h-12 w-full items-start gap-3 rounded-lg px-3 py-2 text-start',
          selected ? 'bg-accent' : 'hover:bg-accent/50',
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
  backTo = '/',
}: {
  ticketId: number
  autoSettle?: boolean
  /** Where Back goes: the floor, or the receipts list that opened this bill. */
  backTo?: '/' | '/receipts'
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()

  const [discardOpen, setDiscardOpen] = useState(false)
  const [moveMode, setMoveMode] = useState<'new' | 'move' | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleGuardOpen, setSettleGuardOpen] = useState(false)
  const [sessionGuardOpen, setSessionGuardOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidGuardOpen, setVoidGuardOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [settleOutcome, setSettleOutcome] = useState<SettleOutcome | null>(null)
  // The orders behind the unattributed lines, while the cashier is choosing
  // who they were for; null when the picker is closed
  const [assignOrderIds, setAssignOrderIds] = useState<number[] | null>(null)
  const [assignLineIds, setAssignLineIds] = useState<number[] | null>(null)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)
  const closeAssign = () => {
    setAssignOrderIds(null)
    setAssignLineIds(null)
  }

  // Voiding is Owner-only (the server enforces the same rule)
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  const ticketQuery = useQuery({
    ...getTicketOptions({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
    }),
    // A discarded or deleted ticket 404s — don't retry that, so the screen
    // learns at once that the bill is gone instead of retrying a dead one
    retry: (count, error) =>
      !(error instanceof AxiosError && error.response?.status === 404) &&
      count < 3,
    // Poll fallback in case the SignalR connection is silently dead
    refetchInterval: 20_000,
  })
  const ticket = ticketQuery.data
  const isLoading = ticketQuery.isLoading
  // Gone: an empty room ticket auto-discarded when its session ended, or any
  // ticket deleted out from under the screen. react-query keeps the last data
  // on error, so a 404 is the only honest signal that the bill no longer exists.
  const ticketGone =
    ticketQuery.isError &&
    ticketQuery.error instanceof AxiosError &&
    ticketQuery.error.response?.status === 404

  // Nothing to do here once the bill is gone — hand the cashier back to the floor
  useEffect(() => {
    if (ticketGone) navigate({ to: backTo })
  }, [ticketGone, navigate, backTo])

  // What guests paid from their phones (pay at table), while the bill is
  // open: the till takes only what is left
  const online = useOnlinePayments(
    ticketId,
    ticket != null && ticket.status !== 'Settled' && ticket.voidedAt == null,
  )

  // App orders for this table or session that have not been accepted yet —
  // they are not on the bill until someone taps Confirm
  const { pending } = usePendingOrders()

  // A bill with a stay on it — a room's, or a timed table's — gets its time
  // only when the clock stops, so the screen shows the running clock and
  // guards the settle until then. The stay is read by id, not off the open
  // list: once it has ended the bill is still open, and the people there
  // are still its account holders
  const stay = useStay(
    ticket?.sessionId,
    ticket?.sessionId != null &&
      ticket?.settledAt == null &&
      ticket?.voidedAt == null,
  )
  const stayActions = useStayActions()

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
      setMoveMode(null)
      setSelecting(false)
      setSelectedIds(new Set())
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  // "Forgot the customer": Ordering owns who an order is for, so the name (or
  // account) goes there — one call per order behind the unattributed lines.
  // Sales re-tags the lines off the event Ordering publishes and nudges the
  // hub; the invalidation below just does not wait for it.
  const assignCustomer = useMutation({ ...assignOrderCustomerMutation() })
  const assignLines = useMutation({ ...assignTicketLinesCustomerMutation() })

  const doAssignCustomer = async (customer: SaleCustomer) => {
    const orderIds = assignOrderIds ?? []
    const lineIds = assignLineIds ?? []
    // Somebody with an account named on a room's lines is in the room:
    // onto the roster, so their share of the time has a tab at settle
    if (
      stay &&
      customer.id &&
      !stayRoster(stay).some((m) => m.id === customer.id)
    ) {
      stayActions.addMember(toNumber(stay.id), customer.id, customer.name)
    }
    try {
      await Promise.all(
        orderIds.map((orderId) =>
          assignCustomer.mutateAsync({
            path: { orderId },
            query: { 'api-version': API_VERSION },
            // A fresh id per call: the server deduplicates a retried request,
            // and a later assignment is a new one
            headers: { 'x-requestid': crypto.randomUUID() },
            body: { customerUserId: customer.id, customerName: customer.name },
          }),
        ),
      )
      // Part of an order (or several): the snapshot on just those lines
      if (lineIds.length > 0) {
        await assignLines.mutateAsync({
          // A retry on café Wi-Fi must not become a second command
          headers: { 'x-requestid': crypto.randomUUID() },
          path: { id: ticketId },
          query: { 'api-version': API_VERSION },
          body: {
            lineIds,
            customerId: customer.id ?? null,
            customerName: customer.name,
          },
        })
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      setSelecting(false)
      setSelectedIds(new Set())
      toast.success(t('customerAssigned'))
    } catch (error) {
      // A 400 carries the domain's own words (cancelled, already somebody's)
      const detail =
        error instanceof AxiosError && typeof error.response?.data === 'string'
          ? error.response.data
          : undefined
      toast.error(
        t('failedToAssignCustomer'),
        detail ? { description: detail } : undefined,
      )
    }
  }

  // Redirecting to the floor — don't flash the stale bill on the way out
  if (ticketGone) {
    return null
  }

  if (isLoading) {
    return (
      <div className='mx-auto flex max-w-3xl flex-col gap-4 p-4'>
        {/* Title, then bill lines (name + amount), then a total — the ticket's shape */}
        <Skeleton className='h-10 w-56' />
        <div className='bg-card flex flex-col gap-4 rounded-xl border p-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex items-center justify-between gap-3'>
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-4 w-14' />
            </div>
          ))}
          <div className='mt-2 flex items-center justify-between gap-3 border-t pt-3'>
            <Skeleton className='h-5 w-20' />
            <Skeleton className='h-5 w-20' />
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className='flex flex-col items-center gap-4 py-24'>
        <p className='text-muted-foreground text-lg'>{t('ticketNotFound')}</p>
        <Button asChild size='lg'>
          <Link to={backTo}>
            {backTo === '/' ? t('backToFloor') : t('goBack')}
          </Link>
        </Button>
      </div>
    )
  }

  const isSettled = ticket.status === 'Settled'
  // Keyed on voidedAt rather than the status string so a voided ticket
  // renders its tombstone even if the status enum ever gains states
  const isVoided = ticket.voidedAt != null
  const lines = ticket.lines ?? []
  const waiting = isSettled || isVoided ? [] : pendingForTicket(pending, ticket)
  const liveStay = isSettled || isVoided ? undefined : stay
  const runningStay = liveStay && isRunning(liveStay) ? liveStay : undefined
  // Ended, bill still open: the time has landed and the roster stays
  // editable so every share can find its tab
  const endedStay =
    liveStay && !isRunning(liveStay) ? liveStay : undefined
  const onlinePaid = onlineSummary(ticket.total, online.payments)

  // Lines in arrival order, grouped by whoever they were rung up for. Insertion
  // order keeps the first person named at the top instead of reshuffling the
  // bill every time someone orders again.
  const groups = lines.reduce<
    {
      key: string | null
      name: string | null
      lines: typeof lines
      total: number
    }[]
  >((acc, line) => {
    // One person is one group however they were named: an account holder by
    // their account, a guest by the id Ordering gave them, and a name the
    // till was only told by the name itself
    const key = line.customerId
      ? `account:${line.customerId}`
      : line.guestId
        ? `guest:${line.guestId}`
        : line.customerName
          ? `name:${line.customerName}`
          : null
    const group = acc.find((g) => g.key === key)
    if (group) {
      group.lines.push(line)
      group.total += toNumber(line.total)
      group.name ??= line.customerName || null
    } else {
      acc.push({
        key,
        name: line.customerName || null,
        lines: [line],
        total: toNumber(line.total),
      })
    }
    return acc
  }, [])

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  // The place is the headline: a cashier arrives here from a tile that said
  // "Table 1" and is standing in front of that table. The kind of place is
  // only spelled out when the name does not already say it — the fallback for
  // a counter ticket, which has no name of its own.
  const typeLabel =
    ticket.type === 'Room'
      ? t('room')
      : ticket.type === 'Table'
        ? t('table')
        : t('counter')
  // What identifies this bill: the place it belongs to, or — for a counter
  // tab, which has no place — the name the cashier gave it. Who ordered is a
  // different question, and the line groups below are the honest answer.
  const placeName = localized(ticket.locationName)
  const location = placeName || typeLabel
  const title = placeName || ticket.label || typeLabel

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

  // Where the lines go: an open bill, a new tab or table, or a fresh ticket
  // for the same place (the split) when nothing else is named
  const doMoveLines = (target: MoveTarget) =>
    moveLines.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
      body: {
        lineIds: Array.from(selectedIds),
        targetTicketId: target.kind === 'ticket' ? target.ticketId : null,
        newTicket:
          target.kind === 'counter'
            ? { type: TICKET_TYPE_COUNTER, label: target.label }
            : target.kind === 'table'
              ? {
                  type: TICKET_TYPE_TABLE,
                  placeId: target.placeId,
                  placeName: target.placeName,
                }
              : null,
      },
    })
  const movableCount = lines.filter((l) => l.source !== 'SessionTime').length

  // Order lines nobody was named for can still be told whose they are —
  // through Ordering, which owns the order. Manual and session-time lines
  // have no order behind them, so a group of only those offers nothing.
  // Selected lines → who gets them. A whole order goes through Ordering: the
  // customer owns the order and its points, so naming (or re-naming) it moves
  // the points with it. Anything less is a Sales-side snapshot on just those
  // lines — the bill grouping, the receipt, an Account tender — and the
  // points stay where they are.
  const assignSelected = () => {
    const byOrder = new Map<number, TicketLineView[]>()
    for (const line of lines) {
      if (line.orderId == null) continue
      const key = toNumber(line.orderId)
      byOrder.set(key, [...(byOrder.get(key) ?? []), line])
    }
    const orderIds: number[] = []
    const lineIds: number[] = []
    for (const [orderId, orderLines] of byOrder) {
      const chosen = orderLines.filter((l) => selectedIds.has(toNumber(l.id)))
      if (chosen.length === 0) continue
      const whole = chosen.length === orderLines.length
      if (whole) orderIds.push(orderId)
      else lineIds.push(...chosen.map((l) => toNumber(l.id)))
    }
    setAssignOrderIds(orderIds)
    setAssignLineIds(lineIds)
  }

  // What the printed receipt shows right after settling, before the
  // refetched (settled) ticket lands
  const paymentsOverride: ReceiptPayment[] | undefined =
    settleOutcome && !ticket.settledAt ? settleOutcome.payments : undefined

  return (
    <div
      className={cn(
        'mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col p-4 pb-28 max-sm:p-3',
        // The phone's bar stacks its actions under the total while they
        // are more than one button, so the list keeps clear of a taller bar
        isSettled || selecting
          ? 'max-sm:pb-[calc(14.5rem+env(safe-area-inset-bottom))]'
          : 'max-sm:pb-[calc(7.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {/* On a phone the bill's tools drop to a row of their own under the
          title, which keeps the whole width for the place's name */}
      <div className='flex flex-wrap items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link
            to={backTo}
            aria-label={backTo === '/' ? t('backToFloor') : t('goBack')}
          >
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <div className='min-w-0 flex-1'>
          {/* Flex + gap rather than a margin on an inline span: with a Latin
              place name in Arabic the bidi algorithm lays the whole line out
              left-to-right and an inline start margin ends up on the outer
              edge, not between the two */}
          <h1 className='flex items-baseline gap-2 text-xl font-bold'>
            <span className='truncate'>{title}</span>
            <span className='text-muted-foreground shrink-0 text-base font-medium tabular-nums'>
              #{toNumber(ticket.id)}
            </span>
          </h1>
        </div>
        {/* A paid table can still be waiting on the kitchen's paper */}
        {isSettled && <KitchenReprintButton lines={ticket.lines ?? []} />}
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
          <div className='flex gap-1 max-sm:basis-full max-sm:justify-end'>
            {/* The pad, pointed at this bill — same flow as a new sale, the
                money just comes later. Everything sold here is on the menu,
                so there is no typed-in line beside it. */}
            <Button
              className='h-12 gap-2 px-3'
              aria-label={t('addItems')}
              onClick={() =>
                navigate({ to: '/sale', search: { ticket: ticketId } })
              }
            >
              <ShoppingCart className='size-5' />
              <span className='hidden sm:inline'>{t('addItems')}</span>
            </Button>
            <Button
              variant={selecting ? 'secondary' : 'outline'}
              className='h-12 gap-2 px-3'
              aria-label={t('selectLines')}
              disabled={lines.length === 0}
              onClick={toggleSelecting}
            >
              <ListChecks className='size-5' />
              <span className='hidden sm:inline'>{t('selectLines')}</span>
            </Button>
            <Button
              variant={toNumber(ticket.discount) > 0 ? 'secondary' : 'outline'}
              className='h-12 gap-2 px-3'
              aria-label={t('discount')}
              disabled={lines.length === 0}
              onClick={() => setDiscountOpen(true)}
            >
              <BadgePercent className='size-5' />
              {/* Once applied, the button reads the amount so the discount
                  is never missed — the bar repeats it under the total */}
              {toNumber(ticket.discount) > 0 ? (
                <span className='tabular-nums'>−{money(ticket.discount)}</span>
              ) : (
                <span className='hidden sm:inline'>{t('discount')}</span>
              )}
            </Button>
            {/* The kitchen's paper again, where a station prints */}
            <KitchenReprintButton lines={lines} />
            {/* Both ways out live up here, deliberately far from the Settle
                button in the bottom bar, so neither can be fat-fingered.
                Nothing on the ticket yet means nothing to audit, so any
                cashier can discard it; once a line lands, only an owner's
                void (with its reason) takes it off the floor. A room ticket
                is discardable too, but only once its session has ended with
                nothing on it — while it runs, there is time still to come. */}
            {lines.length === 0 &&
            (ticket.type !== 'Room' || ticket.sessionEndedAt != null) ? (
              <Button
                variant='outline'
                className='text-destructive hover:text-destructive h-12 gap-2 px-3'
                aria-label={t('discardTicket')}
                onClick={() => setDiscardOpen(true)}
              >
                <Trash2 className='size-5' />
                <span className='hidden sm:inline'>{t('discardTicket')}</span>
              </Button>
            ) : (
              isOwner && (
                <Button
                  variant='outline'
                  className='text-destructive hover:text-destructive h-12 gap-2 px-3'
                  aria-label={t('voidTicket')}
                  onClick={() =>
                    runningStay ? setVoidGuardOpen(true) : setVoidOpen(true)
                  }
                >
                  <Ban className='size-5' />
                  <span className='hidden sm:inline'>{t('voidTicket')}</span>
                </Button>
              )
            )}
          </div>
        )}
      </div>

      <Separator className='my-3' />

      {runningStay && (
        <div className='mb-4'>
          <StayBar stay={runningStay} />
        </div>
      )}

      {endedStay && (
        <div className='bg-card text-card-foreground mb-4 flex flex-col gap-3 rounded-xl border p-3 shadow-xs'>
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Users className='size-4' />
            {t('inTheRoom')}
          </div>
          <StayMembers stay={endedStay} />
        </div>
      )}

      {/* Confirmed here, they land on this bill — which is why the guard
          below stops a settle while any are still waiting */}
      {waiting.length > 0 && (
        <div className='border-amber-500/50 bg-amber-500/10 mb-4 flex flex-col gap-2 rounded-xl border p-3'>
          <div className='flex items-center gap-2 font-semibold'>
            <Clock className='size-5 text-amber-600 dark:text-amber-500' />
            {t('ticketPendingOrders', { count: waiting.length })}
          </div>
          <PendingOrders orders={waiting} />
        </div>
      )}

      {/* The time is not a line until the session ends; until then the
          bill shows it as the row it will become, so the running cost is
          read where the rest of the bill is */}
      {runningStay && (
        <div className='text-muted-foreground flex items-center gap-3 border-b border-dashed py-3'>
          <Timer className='size-5 shrink-0' />
          <span className='min-w-0 flex-1 truncate'>
            {t('roomTimeRunning')}
          </span>
          <span className='shrink-0 tabular-nums'>
            ≈ <TimeSoFar stay={runningStay} />
          </span>
        </div>
      )}

      {lines.length === 0 ? (
        !runningStay && (
          <p className='text-muted-foreground py-16 text-center'>
            {t('emptyTicket')}
          </p>
        )
      ) : groups.length === 1 && groups[0].key === null ? (
        <div className='flex flex-col'>
          <div className='flex flex-col divide-y'>
            {/* Selecting moves individual lines to another ticket, so the rounds
                come back apart the moment the cashier is choosing between them */}
            {(selecting ? lines : mergeIdenticalLines(lines)).map((line) => (
              <LineRow
                key={String(line.id)}
                line={line}
                selecting={selecting && !isSettled}
                selected={selectedIds.has(toNumber(line.id))}
                onToggle={() => toggleLine(toNumber(line.id))}
              />
            ))}
          </div>
          {/* Nobody was named: the till forgot, and the whole bill is one
              "whose was this?" away from grouping under them */}
        </div>
      ) : (
        /* Shared bill: one heading per person, each with its own subtotal, so
           the cashier can read (and split) who owes what. Lines nobody was
           named for stay together under the table's own heading. */
        <div className='flex flex-col gap-4'>
          {groups.map((group) => (
            <div key={group.key ?? '__unattributed__'}>
              <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2'>
                {group.lines[0]?.customerId ? (
                  /* An account holder: tap the name for their card */
                  <button
                    type='button'
                    className='flex min-w-0 items-center gap-2 font-semibold underline-offset-4 hover:underline'
                    onClick={() =>
                      setCardFor({
                        id: String(group.lines[0].customerId),
                        name: group.name ?? '',
                      })
                    }
                  >
                    <User className='size-4 shrink-0' />
                    <span className='truncate'>{group.name ?? t('guest')}</span>
                  </button>
                ) : (
                  <span className='flex min-w-0 items-center gap-2 font-semibold'>
                    <User className='size-4 shrink-0' />
                    <span className='truncate'>
                      {group.name ?? (group.key ? t('guest') : location)}
                    </span>
                  </span>
                )}
                <span className='shrink-0 tabular-nums'>
                  {money(group.total)}
                </span>
              </div>
              <div className='flex flex-col divide-y'>
                {(selecting
                  ? group.lines
                  : mergeIdenticalLines(group.lines)
                ).map((line) => (
                  <LineRow
                    key={String(line.id)}
                    line={line}
                    selecting={selecting && !isSettled}
                    selected={selectedIds.has(toNumber(line.id))}
                    onToggle={() => toggleLine(toNumber(line.id))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isSettled && !isVoided && (
        <OnlinePaymentsPanel
          payments={online.payments}
          summary={onlinePaid}
          billOpen
        />
      )}

      {/* A voided ticket keeps its lines for the record but loses every
          action — what remains is the audit trail */}
      {isVoided && (
        <div className='mt-4 divide-y rounded-lg border text-base'>
          <div className='text-destructive flex items-center gap-2 px-3 py-2 font-semibold'>
            <Ban className='size-5' />
            {t('voidedBadge')}
          </div>
          {ticket.voidReason && (
            <div className='flex items-baseline justify-between gap-4 px-3 py-2'>
              <span className='text-muted-foreground'>{t('reason')}</span>
              <span className='text-end'>{ticket.voidReason}</span>
            </div>
          )}
          {(ticket.voidedBy || ticket.voidedAt) && (
            <div className='flex items-baseline justify-between gap-4 px-3 py-2'>
              <span className='text-muted-foreground'>{t('voidedBy')}</span>
              <span className='text-end tabular-nums'>
                {[
                  ticket.voidedBy,
                  ticket.voidedAt &&
                    new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(ticket.voidedAt)),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Credit notes: money that went back, each with its reason */}
      {(ticket.refunds?.length ?? 0) > 0 && (
        <div className='mt-4 flex flex-col gap-2'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            {t('refundsTitle')}
          </h2>
          <div className='divide-y rounded-lg border'>
            {ticket.refunds!.map((refund) => (
              <div
                key={String(refund.id)}
                className='flex flex-col gap-0.5 px-3 py-2'
              >
                <div className='flex items-baseline justify-between gap-4'>
                  <span className='font-medium'>
                    {t('creditNote', { number: toNumber(refund.number) })}
                  </span>
                  <span className='text-destructive font-semibold tabular-nums'>
                    −{money(refund.amount)}
                  </span>
                </div>
                <p className='text-sm'>{refund.reason}</p>
                <p className='text-muted-foreground text-xs tabular-nums'>
                  {[
                    refund.tender === 'Account' ? t('account') : t('cash'),
                    refund.customerName,
                    refund.refundedBy,
                    refund.refundedAt &&
                      new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(refund.refundedAt)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky action bar: the running total is always in reach, and so is
          the primary action (Settle, or Move while selecting) */}
      {!isVoided && (
        <div className='bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur'>
          <div className='mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2'>
            <div className='min-w-0'>
              <div className='text-muted-foreground text-sm'>{t('total')}</div>
              <div className='text-2xl font-bold tabular-nums'>
                {money(ticket.total)}
              </div>
              {toNumber(ticket.discount) > 0 && (
                <div className='text-xs font-medium text-emerald-600 tabular-nums dark:text-emerald-400'>
                  {t('discount')} −{money(ticket.discount)}
                  {ticket.discountRate != null &&
                    ` (${percent(ticket.discountRate)}%)`}
                </div>
              )}
              {/* The rest of the bill's parts (menu money, service, VAT, what
                went back) are one tap away; the bar carries the total and
                the discount, which the cashier must not miss */}
              {(toNumber(ticket.discount) > 0 ||
                toNumber(ticket.serviceCharge) > 0 ||
                toNumber(ticket.vat) > 0 ||
                toNumber(ticket.refundedTotal) > 0) && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground -ms-2 h-7 px-2 text-xs'
                  onClick={() => setBreakdownOpen(true)}
                >
                  {t('breakdown')}
                </Button>
              )}
              {runningStay && (
                <div className='text-muted-foreground truncate text-xs tabular-nums'>
                  + {t('timeSoFar')} ≈ <TimeSoFar stay={runningStay} />
                </div>
              )}
              {/* Guests paid part (or all) of it from their phones: what the
                till still takes is the rest */}
              {!isSettled && onlinePaid.paid > 0 && (
                <div className='text-sm font-medium tabular-nums'>
                  {onlinePaid.covered
                    ? t('paidOnlineClosing')
                    : t('remainingAfterOnline', {
                        amount: money(onlinePaid.remaining),
                      })}
                </div>
              )}
              {!isSettled && onlinePaid.pending && (
                <div className='flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500'>
                  <Loader2 className='size-3 animate-spin' />
                  {t('guestPayingOnline')}
                </div>
              )}
            </div>
            <div
              className={cn(
                'ms-auto',
                // Several actions: a row of their own under the total, each
                // an equal share of the width
                (isSettled || selecting) && 'max-sm:w-full',
              )}
            >
              {isSettled ? (
                <div className='flex gap-2'>
                  {/* Owner-only, like void: money goes back, so an owner says
                    so. Gone once the whole receipt has been credited. */}
                  {isOwner &&
                    toNumber(ticket.refundedTotal) < toNumber(ticket.total) && (
                      <Button
                        size='lg'
                        variant='outline'
                        className='text-destructive hover:text-destructive h-14 px-5 text-lg max-sm:h-12 max-sm:flex-1 max-sm:px-3 max-sm:text-base'
                        onClick={() => setRefundOpen(true)}
                      >
                        <Undo2 className='size-5' />
                        {t('refundTicket')}
                      </Button>
                    )}
                  <Button
                    size='lg'
                    className='h-14 px-6 text-lg max-sm:h-12 max-sm:flex-1 max-sm:px-3 max-sm:text-base'
                    onClick={() => window.print()}
                  >
                    <Printer className='size-5' />
                    {t('print')}
                  </Button>
                </div>
              ) : selecting ? (
                <div className='flex items-center gap-2 max-sm:grid max-sm:grid-cols-2'>
                  <Button
                    variant='outline'
                    size='lg'
                    className='h-14 gap-2 px-5 text-lg max-sm:col-span-2 max-sm:h-12 max-sm:px-3 max-sm:text-base'
                    disabled={
                      selectedIds.size === 0 ||
                      assignCustomer.isPending ||
                      assignLines.isPending
                    }
                    onClick={assignSelected}
                  >
                    <UserPlus className='size-5' />
                    {t('assignCustomer')}
                  </Button>
                  <Button
                    variant='outline'
                    size='lg'
                    className='h-14 gap-2 px-5 text-lg max-sm:h-12 max-sm:px-3 max-sm:text-base'
                    disabled={selectedIds.size === 0 || moveLines.isPending}
                    onClick={() => setMoveMode('move')}
                  >
                    {t('moveToBill')}
                  </Button>
                  <Button
                    size='lg'
                    className='h-14 gap-2 px-6 text-lg max-sm:h-12 max-sm:px-3 max-sm:text-base'
                    disabled={selectedIds.size === 0 || moveLines.isPending}
                    onClick={() => setMoveMode('new')}
                  >
                    {moveLines.isPending && (
                      <Loader2 className='size-5 animate-spin' />
                    )}
                    {t('newBill')}
                  </Button>
                </div>
              ) : (
                <Button
                  size='lg'
                  className='h-14 px-8 text-lg max-sm:px-6'
                  disabled={lines.length === 0}
                  onClick={() =>
                    runningStay
                      ? setSessionGuardOpen(true)
                      : waiting.length > 0
                        ? setSettleGuardOpen(true)
                        : setSettleOpen(true)
                  }
                >
                  {t('settleAction')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <DiscardTicketDialog
        ticketId={ticketId}
        open={discardOpen}
        onOpenChange={setDiscardOpen}
      />
      <MoveTargetDialog
        open={moveMode !== null}
        mode={moveMode ?? 'move'}
        onOpenChange={(o) => !o && setMoveMode(null)}
        ticket={ticket}
        count={selectedIds.size}
        allSelected={selectedIds.size >= movableCount}
        isPending={moveLines.isPending}
        onPick={doMoveLines}
      />
      <RefundDialog
        ticket={ticket}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
      {/* Two guards before Settle. An order still waiting can be settled
          past (it may be stale); a running session cannot — its time is not
          on the bill yet, so the only way forward is to end it. */}
      <ConfirmDialog
        open={settleGuardOpen}
        onOpenChange={setSettleGuardOpen}
        title={t('settleWithPendingTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('settleAnyway')}
        destructive
        onAction={() => setSettleOpen(true)}
      />
      <ConfirmDialog
        open={sessionGuardOpen}
        onOpenChange={setSessionGuardOpen}
        title={t('settleWithSessionTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('endSessionButton')}
        destructive
        onAction={() => {
          if (runningStay) stayActions.endStay(toNumber(runningStay.id))
        }}
      />
      {/* Same rule for Void, server-enforced too: time that has not landed
          yet is money, and a void would write it off unseen */}
      <ConfirmDialog
        open={voidGuardOpen}
        onOpenChange={setVoidGuardOpen}
        title={t('voidWithSessionTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('endSessionButton')}
        destructive
        onAction={() => {
          if (runningStay) stayActions.endStay(toNumber(runningStay.id))
        }}
      />
      <BreakdownDialog
        ticket={ticket}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        percent={percent}
      />
      <SettleDialog
        ticket={ticket}
        onlinePayments={online.payments}
        members={liveStay?.members}
        open={settleOpen}
        onOpenChange={setSettleOpen}
        onSettled={setSettleOutcome}
      />
      <VoidTicketDialog
        ticketId={ticketId}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
      <DiscountDialog
        ticket={ticket}
        open={discountOpen}
        onOpenChange={setDiscountOpen}
      />
      {/* The sale pad's own picker, reused: an account, or just a name —
          with the room's people first when this is a room's bill */}
      <CustomerDialog
        open={assignOrderIds !== null || assignLineIds !== null}
        onOpenChange={(open) => {
          if (!open) closeAssign()
        }}
        onSelect={doAssignCustomer}
        quickPicks={stayRoster(stay)}
      />
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
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
