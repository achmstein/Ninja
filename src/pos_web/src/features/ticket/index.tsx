import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  BadgePercent,
  Clock,
  Ellipsis,
  ListChecks,
  Loader2,
  Printer,
  ShoppingCart,
  Trash2,
  Undo2,
  User,
  UserPlus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useTakenByText } from '@/features/branch/use-branch-name'
import { BillTitle } from '@/features/deliveries/bill-title'
import { billLabel } from '@/features/deliveries/delivery-format'
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
import { EndedTime } from '@/features/places/ended-time'
import { isRunning, stayRoster } from '@/features/places/status'
import { TimeSoFar } from '@/features/places/time-so-far'
import { useStay, useStayActions } from '@/features/places/use-places'
import { saleTotal, type SaleCustomer } from '@/features/sale/cart'
import { totalWith } from '@/features/sending/bill'
import { landSend, sendsFor, useSending } from '@/features/sending/sending'
import { SendingLines } from '@/features/sending/sending-lines'
import { CustomerSearch } from '@/features/customer/customer-search'
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
import {
  ChangeTenderDialog,
  CORRECTABLE_TENDERS,
  type TenderFix,
} from './change-tender-dialog'
import { tenderLabelKey } from './tenders'
import { SettleDialog, type SettleOutcome } from './settle-dialog'
import { orderIdsOn } from '@/lib/stock-disposition'
import { VoidTicketDialog } from './void-dialog'
import { DiscountDialog } from './discount-dialog'
import { KitchenReprintDialog, useCanReprintKitchen } from './kitchen-reprint'
import { printSheets } from '@/features/printing/print-sheets'
import { BreakdownDialog } from './breakdown-dialog'
import { LineRow, mergeIdenticalLines } from './bill-lines'
import { onlineSummary } from './online-payments'
import { OnlinePaymentsPanel } from './online-payments-panel'
import { useOnlinePayments } from './use-online-payments'

const percent = (rate: number | string | undefined) =>
  Math.round(toNumber(rate) * 10000) / 100

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
  const takenByText = useTakenByText()

  const [discardOpen, setDiscardOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  // The paid bill's payment whose method is being put right
  const [tenderFix, setTenderFix] = useState<TenderFix | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleGuardOpen, setSettleGuardOpen] = useState(false)
  const [sessionGuardOpen, setSessionGuardOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidGuardOpen, setVoidGuardOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [reprintOpen, setReprintOpen] = useState(false)
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

  // Lines charged onto this bill that the server has not confirmed yet
  // (features/sending): shown faded under the bill's own, in its total, and
  // holding the payment until they are in
  const sends = useSending((s) => s.sends)
  const landed = useSending((s) => s.landed)
  const mySends = sendsFor(sends, ticketId)
  const onTheirWay = mySends.filter((x) => x.status !== 'failed')
  const placedHere = mySends.some((x) => x.status === 'placed')

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
    // Poll fallback in case the SignalR connection is silently dead; quick
    // while an order the server took is still to show its lines here
    refetchInterval: placedHere ? 700 : 20_000,
  })
  const ticket = ticketQuery.data
  const canReprint = useCanReprintKitchen(ticket?.lines ?? [])

  // Lines just charged to this bill sit at its end: brought into view as
  // they arrive, so the cashier sees them breathe and land without scrolling
  const sendingRef = useRef<HTMLDivElement>(null)
  const shownSends = useRef(0)
  useEffect(() => {
    const grew = mySends.length > shownSends.current
    shownSends.current = mySends.length
    if (grew)
      sendingRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [mySends.length])

  // An order's lines are on the bill: its faded copy goes, the real ones tick
  useEffect(() => {
    if (!ticket) return
    const orderIds = new Set(
      (ticket.lines ?? []).map((l) => toNumber(l.orderId)),
    )
    for (const send of mySends) {
      if (
        send.status === 'placed' &&
        send.orderId != null &&
        orderIds.has(send.orderId)
      ) {
        landSend(send.requestId, send.orderId)
      }
    }
  }, [ticket, mySends])
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

  // What guests paid from their phones (online payments), while the bill is
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
      setMoving(false)
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
          // A retry on business Wi-Fi must not become a second command
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
        <p className='text-muted-foreground type-body'>{t('ticketNotFound')}</p>
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
  const endedStay = liveStay && !isRunning(liveStay) ? liveStay : undefined
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
  // Who took the order that opened it, and where when another branch sent it here
  const takenBy = takenByText(ticket.takenBy, ticket.takenAtBranchId)
  const location = placeName || typeLabel
  const title = placeName || billLabel(ticket.label).text || typeLabel

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
      // A retry on business Wi-Fi must not become a second command
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

  const isOpen = !isSettled && !isVoided
  const choosing = selecting && isOpen
  const discount = toNumber(ticket.discount)
  // Nothing on the ticket yet means nothing to audit, so any cashier can
  // discard it. A room ticket is discardable too, but only once its session
  // has ended with nothing on it — while it runs, there is time still to
  // come. Once a line lands, only an owner's void (with its reason) takes it
  // off the floor.
  const canDiscard =
    lines.length === 0 &&
    mySends.length === 0 &&
    (ticket.type !== 'Room' || ticket.sessionEndedAt != null)
  const canVoid = !canDiscard && isOwner
  // An open bill with something on it can go on paper before it is paid
  const canPrintBill = isOpen && (ticket.lines?.length ?? 0) > 0
  const hasMenu = isOpen || canReprint
  // The bill's parts (menu money, discount, service, VAT, what went back)
  // are one tap away; the bar carries the total
  const hasParts =
    discount > 0 ||
    toNumber(ticket.serviceCharge) > 0 ||
    toNumber(ticket.vat) > 0 ||
    toNumber(ticket.refundedTotal) > 0
  const total =
    onTheirWay.length > 0 && !isSettled
      ? totalWith(
          ticket,
          onTheirWay.reduce((sum, x) => sum + saleTotal(x.lines), 0),
        )
      : ticket.total
  const noneChosen = selectedIds.size === 0

  // The room, while there is one: running, its whole panel; ended with the
  // bill still open, the time it came to where the clock stood (its money is
  // a line on the bill now), and the people, still editable so every share
  // finds its tab. Until the stay arrives, its shape
  const stayLoading = isOpen && ticket.sessionId != null && stay === undefined
  const room = stayLoading ? (
    <Skeleton className='h-44 rounded-xl' />
  ) : runningStay ? (
    <StayBar stay={runningStay} />
  ) : endedStay ? (
    <div className='flex flex-col gap-6'>
      <EndedTime stay={endedStay} />
      <div className='flex flex-col gap-2'>
        <h2 className='text-muted-foreground type-label'>
          {t('inTheRoom')}
        </h2>
        <StayMembers stay={endedStay} />
      </div>
    </div>
  ) : null

  // Side by side in the bar, every action the main action's height; the
  // main one wide enough to be the obvious one
  const actionClass = (main = false) =>
    cn(
      'h-14 gap-2 max-sm:min-w-0 max-sm:flex-1 max-sm:px-3 max-sm:text-base',
      main ? 'min-w-60 px-6 text-lg' : 'min-w-40 px-5 text-base',
    )

  // Every bill is laid out the same: the header across the top, the money
  // and what is done with it in the bar across the foot, so Settle, the
  // Select actions and Print are always in the same place. A room adds only
  // its panel (the clock, the rate, the people, the way to end it) beside
  // the lines; a narrow screen puts it over them.
  return (
    <div className='flex h-[calc(100svh-4rem)] flex-col'>
      {/* The header row, ruled off like the sale pad's: the way back, the
          place, then the two things a cashier does most (add, select) as
          buttons and the rest (discount, the kitchen's paper, discard or
          void) in ⋯, far from Settle in the bar so none of them can be
          fat-fingered */}
      <div className='flex h-16 shrink-0 items-center gap-2 border-b px-3 max-sm:px-2'>
        <Button
          asChild
          variant='ghost'
          size='icon'
          className='size-12 shrink-0'
        >
          <Link
            to={backTo}
            aria-label={backTo === '/' ? t('backToFloor') : t('goBack')}
          >
            <BackIcon className='size-6' />
          </Link>
        </Button>
        {/* Flex + gap rather than a margin on an inline span: with a Latin
            place name in Arabic the bidi algorithm lays the whole line out
            left-to-right and an inline start margin ends up on the outer
            edge, not between the two */}
        <h1 className='flex min-w-0 flex-1 items-baseline gap-2 type-title'>
          <BillTitle title={title} className='truncate' />
          <span className='text-muted-foreground shrink-0 type-detail font-medium tabular-nums'>
            #{toNumber(ticket.id)}
          </span>
        </h1>
        {isSettled ? (
          <Badge className='h-8 shrink-0 px-3 text-sm' variant='secondary'>
            {t('settledBadge')}
            {ticket.receiptNumber != null &&
              ` · ${t('receiptNumber', { number: toNumber(ticket.receiptNumber) })}`}
          </Badge>
        ) : isVoided ? (
          <Badge className='h-8 shrink-0 px-3 text-sm' variant='destructive'>
            {t('voidedBadge')}
          </Badge>
        ) : (
          <>
            {/* The pad, pointed at this bill — same flow as a new sale, the
                money just comes later */}
            <Button
              className='h-12 shrink-0 gap-2 px-3'
              aria-label={t('addItems')}
              onClick={() =>
                navigate({ to: '/order/$ticketId', params: { ticketId: String(ticketId) } })
              }
            >
              <ShoppingCart className='size-5' />
              <span className='max-sm:hidden'>{t('addItems')}</span>
            </Button>
            <Button
              variant={selecting ? 'secondary' : 'outline'}
              className='h-12 shrink-0 gap-2 px-3'
              aria-label={t('selectLines')}
              disabled={lines.length === 0}
              onClick={toggleSelecting}
            >
              <ListChecks className='size-5' />
              <span className='max-sm:hidden'>{t('selectLines')}</span>
            </Button>
          </>
        )}
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='size-12 shrink-0'
                aria-label={t('moreActions')}
              >
                <Ellipsis className='size-5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-56'>
              {isOpen && (
                <DropdownMenuItem
                  className='h-12 gap-3 px-3 text-base'
                  disabled={lines.length === 0}
                  onSelect={() => setDiscountOpen(true)}
                >
                  <BadgePercent className='size-5' />
                  <span className='flex-1'>{t('discount')}</span>
                  {/* Once applied, the row reads the amount; the bar repeats
                      it under the total */}
                  {discount > 0 && (
                    <span className='text-emerald-600 tabular-nums dark:text-emerald-400'>
                      −{money(ticket.discount)}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {/* The bill on paper before it is paid: the customer looks it
                  over, then says how they pay */}
              {canPrintBill && (
                <DropdownMenuItem
                  className='h-12 gap-3 px-3 text-base'
                  onSelect={() => void printSheets()}
                >
                  <Printer className='size-5' />
                  {t('printBill')}
                </DropdownMenuItem>
              )}
              {canReprint && (
                <DropdownMenuItem
                  className='h-12 gap-3 px-3 text-base'
                  onSelect={() => setReprintOpen(true)}
                >
                  <Printer className='size-5' />
                  {t('kitchenTickets')}
                </DropdownMenuItem>
              )}
              {isOpen && canDiscard ? (
                <DropdownMenuItem
                  variant='destructive'
                  className='h-12 gap-3 px-3 text-base'
                  onSelect={() => setDiscardOpen(true)}
                >
                  <Trash2 className='size-5' />
                  {t('discardTicket')}
                </DropdownMenuItem>
              ) : (
                isOpen &&
                canVoid && (
                  <DropdownMenuItem
                    variant='destructive'
                    className='h-12 gap-3 px-3 text-base'
                    onSelect={() =>
                      runningStay ? setVoidGuardOpen(true) : setVoidOpen(true)
                    }
                  >
                    <Ban className='size-5' />
                    {t('voidTicket')}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className='flex min-h-0 flex-1 flex-col overflow-y-auto min-[900px]:flex-row min-[900px]:overflow-hidden'>
        {room && (
          // A light tint: the room's own surface beside the bill, not more
          // of its list
          <aside className='shrink-0 p-4 pb-2 min-[900px]:order-last min-[900px]:w-[340px] min-[900px]:overflow-y-auto min-[900px]:border-s min-[900px]:bg-muted/40 min-[900px]:pb-4 xl:w-[380px]'>
            {room}
          </aside>
        )}

        <div className='flex flex-col p-4 min-[900px]:min-w-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto'>
          {/* Who took it, only when another branch did (a phone order sent
              here): why a bill nobody here rang up is on the floor, and whom
              to ask. Taken here, everyone on shift knows */}
          {takenBy && ticket.takenAtBranchId != null && (
            <p className='text-muted-foreground mb-3 type-detail'>{takenBy}</p>
          )}

          {/* Confirmed here, they land on this bill — which is why the guard
              stops a settle while any are still waiting */}
          {waiting.length > 0 && (
            <div className='border-amber-500/50 bg-amber-500/10 mb-4 flex flex-col gap-2 rounded-xl border p-3'>
              <div className='flex items-center gap-2 font-semibold'>
                <Clock className='size-5 text-amber-600 dark:text-amber-500' />
                {t('ticketPendingOrders', { count: waiting.length })}
              </div>
              <PendingOrders orders={waiting} />
            </div>
          )}

          {lines.length === 0 ? (
            // Nothing to say while a session runs: the clock in the panel is
            // the bill so far; nor while lines are on their way
            !runningStay &&
            mySends.length === 0 && (
              <p className='text-muted-foreground py-16 text-center'>
                {t('emptyTicket')}
              </p>
            )
          ) : groups.length === 1 && groups[0].key === null ? (
            <div className='flex flex-col divide-y'>
              {/* Selecting moves individual lines to another ticket, so the
                  rounds come back apart the moment the cashier is choosing
                  between them */}
              {(choosing ? lines : mergeIdenticalLines(lines)).map((line) => (
                <LineRow
                  key={String(line.id)}
                  line={line}
                  selecting={choosing}
                  selected={selectedIds.has(toNumber(line.id))}
                  onToggle={() => toggleLine(toNumber(line.id))}
                  landed={landed.includes(toNumber(line.orderId))}
                />
              ))}
            </div>
          ) : (
            /* Shared bill: one heading per person, each with its own
               subtotal, so the cashier can read (and split) who owes what.
               Lines nobody was named for stay together under the table's own
               heading. */
            <div className='flex flex-col gap-4'>
              {groups.map((group) => (
                <div key={group.key ?? '__unattributed__'}>
                  <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2'>
                    {group.lines[0]?.customerId ? (
                      /* An account holder: tap the name for their card */
                      <button
                        type='button'
                        className='flex min-w-0 items-center gap-2 type-heading underline-offset-4 hover:underline'
                        onClick={() =>
                          setCardFor({
                            id: String(group.lines[0].customerId),
                            name: group.name ?? '',
                          })
                        }
                      >
                        <User className='size-4 shrink-0' />
                        <span className='truncate'>
                          {group.name ?? t('guest')}
                        </span>
                      </button>
                    ) : (
                      <span className='flex min-w-0 items-center gap-2 type-heading'>
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
                    {(choosing
                      ? group.lines
                      : mergeIdenticalLines(group.lines)
                    ).map((line) => (
                      <LineRow
                        key={String(line.id)}
                        line={line}
                        selecting={choosing}
                        selected={selectedIds.has(toNumber(line.id))}
                        onToggle={() => toggleLine(toNumber(line.id))}
                        landed={landed.includes(toNumber(line.orderId))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOpen && <SendingLines ref={sendingRef} sends={mySends} />}

          {isOpen && (
            <OnlinePaymentsPanel
              payments={online.payments}
              summary={onlinePaid}
              billOpen
            />
          )}

          {/* A voided ticket keeps its lines for the record but loses every
              action — what remains is the audit trail */}
          {isVoided && (
            <div className='mt-4 divide-y rounded-lg border type-body'>
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

          {/* How a paid bill was paid; a cash, card or InstaPay payment can be
              put right while the shift is open (Cash pressed, InstaPay sent) */}
          {ticket.settledAt && (ticket.payments?.length ?? 0) > 0 && (
            <div className='mt-4 flex flex-col gap-2'>
              <h2 className='text-muted-foreground type-label'>
                {t('paymentsTitle')}
              </h2>
              <div className='divide-y rounded-lg border'>
                {ticket.payments!.map((payment, i) => (
                  <div
                    key={String(payment.id ?? i)}
                    className='flex flex-col gap-0.5 px-3 py-2'
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <span className='font-medium'>
                        {[
                          t(tenderLabelKey[payment.tender ?? ''] ?? 'cash'),
                          payment.customerName,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <div className='flex items-center gap-2'>
                        <span className='font-semibold tabular-nums'>
                          {money(payment.amount)}
                        </span>
                        {payment.id != null &&
                          (ticket.refunds?.length ?? 0) === 0 &&
                          CORRECTABLE_TENDERS.includes(payment.tender ?? '') && (
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() =>
                                setTenderFix({
                                  paymentId: toNumber(payment.id),
                                  tender: payment.tender ?? '',
                                  amount: money(payment.amount),
                                })
                              }
                            >
                              {t('changeTender')}
                            </Button>
                          )}
                      </div>
                    </div>
                    {payment.tenderChangedFrom && (
                      <p className='text-muted-foreground type-caption tabular-nums'>
                        {t('tenderChangedFrom', {
                          from: t(tenderLabelKey[payment.tenderChangedFrom] ?? 'cash'),
                          name: payment.tenderChangedBy ?? '',
                          time: payment.tenderChangedAt
                            ? new Intl.DateTimeFormat(locale, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(payment.tenderChangedAt))
                            : '',
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit notes: money that went back, each with its reason */}
          {(ticket.refunds?.length ?? 0) > 0 && (
            <div className='mt-4 flex flex-col gap-2'>
              <h2 className='text-muted-foreground type-label'>
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
                    <p className='type-detail'>{refund.reason}</p>
                    <p className='text-muted-foreground type-caption tabular-nums'>
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
        </div>
      </div>

      {/* The bar across every bill's foot, room or table alike: the money at
          the start, and at the end what is done with the bill — Settle;
          while lines are picked, where they go; once paid, Print and an
          owner's Refund. A phone puts several actions on a row of their own */}
      <div className='flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'>
        <div className='min-w-0 flex-1'>
          <div className='flex h-10 items-center gap-1'>
            {/* While lines are picked, how many, where the actions for them are */}
            <span className='text-muted-foreground truncate type-detail'>
              {choosing
                ? t('selectedLinesCount', { count: selectedIds.size })
                : t('total')}
            </span>
            {hasParts && (
              <Button
                variant='ghost'
                className='text-muted-foreground h-10 px-2 text-sm'
                onClick={() => setBreakdownOpen(true)}
              >
                {t('breakdown')}
              </Button>
            )}
          </div>
          <div className='truncate type-figure'>
            {money(total)}
          </div>
          {discount > 0 && (
            <div className='truncate type-caption font-medium text-emerald-600 tabular-nums dark:text-emerald-400'>
              {t('discount')} −{money(ticket.discount)}
              {ticket.discountRate != null &&
                ` (${percent(ticket.discountRate)}%)`}
            </div>
          )}
          {/* Guests paid part (or all) of it from their phones: what the
              till still takes is the rest */}
          {isOpen && onlinePaid.paid > 0 && (
            <div className='truncate type-detail font-medium tabular-nums'>
              {onlinePaid.covered
                ? t('paidOnlineClosing')
                : t('remainingAfterOnline', {
                    amount: money(onlinePaid.remaining),
                  })}
            </div>
          )}
          {isOpen && onlinePaid.pending && (
            <div className='flex items-center gap-1 type-caption text-amber-600 dark:text-amber-500'>
              <Loader2 className='size-3 animate-spin' />
              {t('guestPayingOnline')}
            </div>
          )}
          {runningStay && (
            <div className='text-muted-foreground truncate type-caption tabular-nums'>
              + {t('timeSoFar')} ≈ <TimeSoFar stay={runningStay} />
            </div>
          )}
        </div>

        {isVoided ? null : isSettled ? (
          <div className='flex gap-2 max-sm:w-full'>
            <Button
              size='lg'
              className={actionClass(true)}
              onClick={() => void printSheets()}
            >
              <Printer className='size-5' />
              {t('print')}
            </Button>
            {/* Owner-only, like void: money goes back, so an owner says so.
                Gone once the whole receipt has been credited. */}
            {isOwner &&
              toNumber(ticket.refundedTotal) < toNumber(ticket.total) && (
                <Button
                  size='lg'
                  variant='outline'
                  className={cn(
                    actionClass(),
                    'text-destructive hover:text-destructive',
                  )}
                  onClick={() => setRefundOpen(true)}
                >
                  <Undo2 className='size-5' />
                  {t('refundTicket')}
                </Button>
              )}
          </div>
        ) : choosing ? (
          <div className='flex gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2'>
            <Button
              variant='outline'
              size='lg'
              className={cn(actionClass(), 'max-sm:col-span-2')}
              disabled={
                noneChosen || assignCustomer.isPending || assignLines.isPending
              }
              onClick={assignSelected}
            >
              <UserPlus className='size-5' />
              {t('assignCustomer')}
            </Button>
            <Button
              size='lg'
              className={actionClass(true)}
              disabled={noneChosen || moveLines.isPending}
              onClick={() => setMoving(true)}
            >
              {moveLines.isPending ? (
                <Loader2 className='size-5 animate-spin' />
              ) : (
                <ArrowRightLeft className='size-5' />
              )}
              {t('moveItems')}
            </Button>
          </div>
        ) : (
          <Button
            size='lg'
            className={actionClass(true)}
            // Not while a guest is at the provider's checkout, nor before
            // every line charged here is in: the money is never taken
            // against a bill the server has not got all of
            disabled={
              lines.length === 0 || mySends.length > 0 || onlinePaid.pending
            }
            onClick={() =>
              runningStay
                ? setSessionGuardOpen(true)
                : waiting.length > 0
                  ? setSettleGuardOpen(true)
                  : setSettleOpen(true)
            }
          >
            {onTheirWay.length > 0 ? (
              <>
                <Loader2 className='size-5 animate-spin' />
                {t('confirming')}
              </>
            ) : (
              t('settleAction')
            )}
          </Button>
        )}
      </div>

      <DiscardTicketDialog
        ticketId={ticketId}
        open={discardOpen}
        onOpenChange={setDiscardOpen}
      />
      <MoveTargetDialog
        open={moving}
        onOpenChange={setMoving}
        ticket={ticket}
        count={selectedIds.size}
        allSelected={selectedIds.size >= movableCount}
        suggestedName={oneCustomer(
          (ticket.lines ?? []).filter((line) => selectedIds.has(toNumber(line.id))),
        )}
        isPending={moveLines.isPending}
        onPick={doMoveLines}
      />
      <RefundDialog
        ticket={ticket}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
      <ChangeTenderDialog
        ticketId={toNumber(ticket.id)}
        payment={tenderFix}
        onOpenChange={(open) => !open && setTenderFix(null)}
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
        title={title}
        onlinePayments={online.payments}
        members={liveStay?.members}
        open={settleOpen}
        onOpenChange={(open) => {
          setSettleOpen(open)
          // Paid, the bill is done: Done (or the way back) from the settled
          // page goes on to the open bills, not back to a closed bill with
          // nothing left to do on it. Left unpaid, the cashier is back on it
          if (!open && settleOutcome) navigate({ to: '/' })
        }}
        onSettled={setSettleOutcome}
      />
      <VoidTicketDialog
        ticketId={ticketId}
        orderIds={orderIdsOn(ticket?.lines ?? [])}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
      <DiscountDialog
        ticket={ticket}
        open={discountOpen}
        onOpenChange={setDiscountOpen}
      />
      <KitchenReprintDialog
        lines={lines}
        open={reprintOpen}
        onOpenChange={setReprintOpen}
      />
      {/* The sale pad's own picker, reused: an account, or just a name —
          with the room's people first when this is a room's bill */}
      <CustomerSearch
        open={assignOrderIds !== null || assignLineIds !== null}
        onOpenChange={(open) => {
          if (!open) closeAssign()
        }}
        onPick={doAssignCustomer}
        offered={stayRoster(stay)}
      />
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />
      {isSettled || settleOutcome ? (
        <ReceiptSheet
          ticket={ticket}
          paymentsOverride={paymentsOverride}
          receiptNumberOverride={settleOutcome?.receiptNumber}
        />
      ) : (
        canPrintBill && <ReceiptSheet ticket={ticket} unpaid />
      )}
    </div>
  )
}

/** The one customer every given line is for, by name: none when a line is nobody's or there are two */
function oneCustomer(lines: { customerId?: string | null; customerName?: string | null }[]): string | null {
  let key: string | null = null
  let name: string | null = null
  for (const line of lines) {
    const n = (line.customerName ?? '').trim()
    if (!n) return null
    const k = line.customerId ? String(line.customerId) : n
    if (key !== null && k !== key) return null
    key = k
    name = n
  }
  return name
}
