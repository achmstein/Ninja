import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRightLeft, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CustomerSearch } from '@/features/customer/customer-search'
import { billLabel } from '@/features/deliveries/delivery-format'
import { PhoneDeliveryForm } from '@/features/deliveries/phone-delivery-form'
import { pendingTicketCustomerKey } from '@/features/floor/new-ticket-dialog'
import { stayRoster } from '@/features/places/status'
import { useStayActions } from '@/features/places/use-places'
import { totalWith } from '@/features/sending/bill'
import { MoveTargetDialog, type MoveTarget } from '@/features/ticket/move-target-dialog'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useTillItems } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { BillPayment } from './bill-payment'
import { billPeople } from './bill-people'
import { lineKey, saleCount, saleTotal, useSale, type SaleCustomer, type SaleLine } from './cart'
import { CustomizeDialog } from './customize-dialog'
import { ItemPad } from './item-pad'
import { OrderPanel, type PrimaryAction } from './order-panel'
import { PartPaymentSheet, type PartToPay } from './part-payment-sheet'
import { PayWhoSheet, payersOf, type Payer } from './pay-who-sheet'
import { PriceReviewDialog } from './price-review-dialog'
import { SendSheet } from './send-sheet'
import { useBillLines } from './use-bill-lines'
import { useMenu } from './use-menu'
import { useOpenBill } from './use-open-bill'
import { usePlaceOrder } from './use-place-order'
import { useSaleDelivery } from './use-sale-delivery'

/** The one customer every given line is for, by name: none when a line is nobody's or there are two */
function oneName(lines: { customerId?: string | null; customerName?: string | null }[]): string | null {
  const names = new Set(lines.map((line) => (line.customerId ? `id:${line.customerId}` : (line.customerName ?? ''))))
  return names.size === 1 && lines[0]?.customerName ? lines[0].customerName : null
}

/** The customer a tab was opened for (the new-tab dialog): read once, then forgotten */
function takePendingCustomer(ticketId: number): SaleCustomer | null {
  try {
    const key = pendingTicketCustomerKey(ticketId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    localStorage.removeItem(key)
    const customer = JSON.parse(raw) as SaleCustomer
    return customer?.id ? customer : null
  } catch {
    return null
  }
}

/**
 * The order screen: the menu on one side, the order on the other, for every
 * kind of order.
 *
 * With no `ticketId` it is a new sale: a counter sale (charged, then paid on
 * the spot) or a delivery. Given a `ticketId` it is that open bill (a table,
 * a room, a tab): what is on it already sits under what is being rung up, a
 * round is sent with one button that asks who it is for, and with nothing new
 * the button takes the money.
 *
 * This file only puts the parts together: the menu (`useMenu`, `ItemPad`),
 * the order (`OrderPanel`), the bill it is rung onto (`useOpenBill`) and the
 * ways an order is sent (`usePlaceOrder`).
 */
export function SalePad({
  ticketId,
  payOnArrival = false,
  backTo,
}: {
  ticketId?: number
  /** Opened to be paid at once: a part of a bill, split off for one person */
  payOnArrival?: boolean
  /** The bill this one was split from: where the till goes once it is paid */
  backTo?: number
}) {
  const onBill = ticketId !== undefined
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // The owner's choice in admin: photo tiles, or text tiles for a long menu,
  // which on a tablet lists its categories down the side
  const compact = useTillItems() === 'compact'
  const rail = compact && !isMobile

  const { lines, note, customer, add: addToSale, setQuantity, setNote, setCustomer, setTarget, clear } = useSale()
  // Before paint, so the cashier never sees another order's lines: the cart
  // empties whenever it is pointed somewhere else, a new sale included
  useLayoutEffect(() => {
    setTarget(ticketId ?? null)
  }, [ticketId, setTarget])

  // On a phone the order lives in a sheet under the menu, opened from the bar
  // along the bottom; a tablet keeps it beside the menu
  const [orderOpen, setOrderOpen] = useState(false)
  const [findingCustomer, setFindingCustomer] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  // Taking the money: asked who pays when the bill is more than one person's, then the payment itself
  const [askingWho, setAskingWho] = useState(false)
  const [paying, setPaying] = useState(false)
  // Sent lines being picked, to split off, move to another bill or name: null when they are not
  const [picked, setPicked] = useState<ReadonlySet<number> | null>(null)
  const [moving, setMoving] = useState(false)
  const [naming, setNaming] = useState(false)
  // A new sale can go out with a rider instead (use-sale-delivery)
  const saleDelivery = useSaleDelivery(onBill)
  const order = usePlaceOrder({ ticketId, saleDelivery, onBeforeCharge: () => setOrderOpen(false) })

  // The open bill, when there is one: its lines, what is on its way, its room's clock
  const bill = useOpenBill(ticketId)
  const sent = bill.ticket?.lines ?? []
  // The bill went (discarded under the screen): back to the floor. Paid or
  // voided: nothing more is rung onto it, its own page says the rest
  useEffect(() => {
    if (bill.gone) navigate({ to: '/' })
    else if (bill.closed && ticketId !== undefined && !paying)
      navigate({ to: '/ticket/$ticketId', params: { ticketId: String(ticketId) }, replace: true })
  }, [bill.gone, bill.closed, ticketId, navigate, paying])

  // The sale's rows by line, so the one just rung up can be scrolled to, and
  // how many times each was rung up here, so its tint starts again on every tap
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [rungUp, setRungUp] = useState<Record<string, number>>({})
  /** Adds the line and brings its row into view */
  const add = (line: SaleLine) => {
    addToSale(line)
    const key = lineKey(line)
    setRungUp((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }))
    // Two frames: the row is rendered by the first, laid out by the second
    requestAnimationFrame(() =>
      requestAnimationFrame(() => rowRefs.current.get(key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })),
    )
  }
  // A new sale's customer brings their usuals; a bill is nobody's until Send
  const menu = useMenu({ customerId: onBill ? null : (customer?.id ?? null), rail, lines, onAdd: add })

  // Who Send offers for a round: the room's people, whoever earlier rounds
  // were for, and anyone named since this bill was opened here
  const [named, setNamed] = useState<SaleCustomer[]>([])
  useEffect(() => {
    const opened = ticketId === undefined ? null : takePendingCustomer(ticketId)
    setNamed(opened ? [opened] : [])
    setSendOpen(false)
    setPicked(null)
    setAskingWho(false)
    setPaying(false)
  }, [ticketId])
  const roster = stayRoster(bill.stay)
  const people = billPeople(roster, sent, named)
  const stayActions = useStayActions()
  /** The ticked part of the round goes for this person; what is left keeps the sheet open for the next name */
  const sendRound = (part: SaleLine[], who: SaleCustomer | null) => {
    if (!order.sendRound(part, who)) return
    if (who) {
      setNamed((known) => [...known, who])
      // Somebody new to the room: the cashier is telling us they are there,
      // and their share of the time will need a tab at settle
      if (bill.stay && who.id && !roster.some((member) => member.id === who.id)) {
        stayActions.addMember(toNumber(bill.stay.id), who.id, who.name)
      }
    }
    if (part.length === lines.length) setSendOpen(false)
  }

  // What is done to lines already on the bill: moved to another bill, or told whose they are
  const billLines = useBillLines(bill.ticket)
  const pickedIds = [...(picked ?? [])]
  const movable = sent.filter((line) => line.source !== 'SessionTime')
  const stopPicking = () => {
    setPicked(null)
    setMoving(false)
    setNaming(false)
  }
  /** The picked lines go to another bill; the till follows them there */
  const movePicked = async (target: MoveTarget) => {
    try {
      const to = await billLines.move(pickedIds, target)
      toast.success(t('linesMoved'))
      stopPicking()
      navigate({ to: '/order/$ticketId', params: { ticketId: String(to) } })
    } catch (error) {
      handleServerError(error)
    }
  }

  // Who could pay their own part. Asked only when there is more than one,
  // and never under a running clock, whose time is not on the bill yet
  const payers = payersOf(sent)
  const pay = () => (payers.length > 1 && !bill.runningStay ? setAskingWho(true) : setPaying(true))
  // What is still to pay: the bill less what was taken in parts already
  const partPaid = toNumber(bill.ticket?.partPaid)
  const leftToPay = bill.ticket ? Math.max(0, Math.round((toNumber(bill.ticket.total) - partPaid) * 100) / 100) : 0
  const [part, setPart] = useState<PartToPay | null>(null)
  /**
   * One person's part is paid on its own, the bill staying open for the rest.
   * Their items carry their share of the bill's service, tax and discount. The
   * last part is the bill's rest: that is its ordinary payment, which closes it
   */
  const payFor = (payer: Payer) => {
    setAskingWho(false)
    const menu = sent.reduce((sum, line) => sum + toNumber(line.total), 0)
    const share = menu > 0 ? Math.round(payer.subtotal * (toNumber(bill.ticket?.total) / menu) * 100) / 100 : 0
    if (share <= 0 || share >= leftToPay) return setPaying(true)
    setPart({ name: payer.name, lineIds: payer.lineIds, amount: share })
  }
  // Split off to be paid: the payment opens as soon as the bill is read. Once
  const paidOnArrival = useRef(false)
  useEffect(() => {
    if (!payOnArrival || paidOnArrival.current || !bill.ticket || bill.closed) return
    paidOnArrival.current = true
    setPaying(true)
  }, [payOnArrival, bill.ticket, bill.closed])

  const count = saleCount(lines)
  const itemsTotal = saleTotal(lines)
  // What it comes to: the whole bill with what is on its way and what is new, or the new sale with its delivery
  const total = bill.ticket
    ? totalWith(bill.ticket, bill.onTheirWay.reduce((sum, x) => sum + saleTotal(x.lines), 0) + itemsTotal)
    : itemsTotal + saleDelivery.fee
  const title = !onBill
    ? t('currentSale')
    : bill.ticket
      ? localized(bill.ticket.locationName) ||
        billLabel(bill.ticket.label).text ||
        t(bill.ticket.type === 'Room' ? 'room' : bill.ticket.type === 'Table' ? 'table' : 'counter')
      : ''

  // One button at the order's foot. On a bill: send what is new, or with
  // nothing new take the money (its own page takes it, with its guards: a
  // running clock, orders still waiting). A new sale: charge it or send the delivery
  const primary: PrimaryAction = !onBill
    ? {
        label: saleDelivery.delivering ? t('deliverySend') : t('chargeAction'),
        amount: total,
        // A delivery waits for its terms rather than going out as a counter sale
        disabled: lines.length === 0 || order.pending || (saleDelivery.delivering && saleDelivery.readiness !== 'ready'),
        onClick: order.charge,
      }
    : lines.length > 0
      ? { label: t('sendNewItems', { count }), amount: itemsTotal, disabled: false, onClick: () => setSendOpen(true) }
      : {
          label: bill.onTheirWay.length > 0 ? t('confirming') : t('settleAction'),
          busy: bill.onTheirWay.length > 0,
          // Never against a bill the server has not got all of
          disabled: sent.length === 0 || bill.mySends.length > 0,
          onClick: pay,
        }

  // A phone shows the menu first; a bill with something on it opens on the
  // bill instead. Once per bill
  const openedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!isMobile || ticketId === undefined || !bill.ticket || openedFor.current === ticketId) return
    openedFor.current = ticketId
    if ((bill.ticket.lines ?? []).length > 0) setOrderOpen(true)
  }, [isMobile, ticketId, bill.ticket])

  const togglePicked = (lineId: number) =>
    setPicked((now) => {
      const next = new Set(now ?? [])
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })

  const orderPanel = (
    <OrderPanel
      Heading={isMobile ? SheetTitle : 'h2'}
      title={title}
      ticketId={ticketId}
      bill={bill}
      customer={customer}
      onFindCustomer={() => setFindingCustomer(true)}
      onRemoveCustomer={() => setCustomer(null)}
      saleDelivery={saleDelivery}
      lines={lines}
      count={count}
      rungUp={rungUp}
      rowRefs={rowRefs}
      onSetQuantity={setQuantity}
      suggestions={menu.suggestions}
      onSuggestion={(item) => menu.tapItem(item, true)}
      note={note}
      onNote={setNote}
      total={total}
      partPaid={partPaid}
      deliveryFee={saleDelivery.fee}
      primary={primary}
      onClear={clear}
      selection={picked ? { chosen: picked, onToggle: togglePicked } : undefined}
      onSelectLines={() => setPicked(new Set())}
      footer={
        picked && (
          // The lines ticked, and what is done with them
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between'>
              <span className='type-detail font-medium'>{t('selectedLinesCount', { count: picked.size })}</span>
              <Button variant='ghost' className='h-10' onClick={stopPicking}>
                {t('cancel')}
              </Button>
            </div>
            {/* Two things can be done with them: say whose they are, or move them (one list of every place they can go) */}
            <div className='grid grid-cols-2 gap-2'>
              <Button variant='outline' className='h-14 min-w-0 gap-2 text-base' disabled={picked.size === 0 || billLines.assigning} onClick={() => setNaming(true)}>
                <UserPlus className='size-5 shrink-0' />
                {t('assignCustomer')}
              </Button>
              <Button className='h-14 min-w-0 gap-2 text-base' disabled={picked.size === 0 || billLines.moving} onClick={() => setMoving(true)}>
                <ArrowRightLeft className='size-5 shrink-0' />
                {t('moveItems')}
              </Button>
            </div>
          </div>
        )
      }
    />
  )

  return (
    <div className='flex h-[calc(100svh-4rem)]'>
      <ItemPad
        menu={menu}
        compact={compact}
        rail={rail}
        foot={
          // The phone's way to the order: always on screen under the menu,
          // reading what is new in it and what it comes to
          isMobile && (
            <div className='border-t p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]'>
              <Button size='lg' className='h-14 w-full justify-between gap-3 px-4 text-base' onClick={() => setOrderOpen(true)}>
                <span className='flex min-w-0 items-center gap-2'>
                  {count > 0 && (
                    <span className='bg-primary-foreground text-primary flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums'>
                      {count}
                    </span>
                  )}
                  <span className='truncate font-semibold'>{t('viewOrder')}</span>
                </span>
                <span className='shrink-0 text-lg font-semibold tabular-nums'>{money(total)}</span>
              </Button>
            </div>
          )
        }
      />

      {isMobile ? (
        <Sheet open={orderOpen} onOpenChange={setOrderOpen}>
          <SheetContent aria-describedby={undefined} className='h-[calc(100svh-2.5rem)]'>
            {orderPanel}
          </SheetContent>
        </Sheet>
      ) : (
        <aside className='flex w-[340px] shrink-0 flex-col border-s xl:w-[380px]'>{orderPanel}</aside>
      )}

      <CustomizeDialog
        item={menu.customize.item}
        customerId={onBill ? null : (customer?.id ?? null)}
        onOpenChange={(open) => !open && menu.customize.close()}
        onAdd={menu.customize.add}
      />
      {/* A new sale's customer, found by name; a bill's round asks through the Send sheet */}
      <CustomerSearch open={findingCustomer} onOpenChange={setFindingCustomer} onPick={setCustomer} />
      <SendSheet open={sendOpen && lines.length > 0} onOpenChange={setSendOpen} lines={lines} people={people} onSend={sendRound} />
      <PhoneDeliveryForm
        open={saleDelivery.formOpen}
        onOpenChange={saleDelivery.setFormOpen}
        initial={saleDelivery.delivery}
        customer={customer}
        itemsTotal={itemsTotal}
        onSave={saleDelivery.save}
      />
      <PriceReviewDialog
        review={order.priceReview.review}
        branch={order.priceReview.branch}
        onClose={order.priceReview.close}
        onUse={order.priceReview.use}
        onKeepHere={order.priceReview.keepHere}
      />
      {order.offlineElement}

      {/* What is done with the lines picked on the bill */}
      {bill.ticket && (
        <MoveTargetDialog
          open={moving}
          onOpenChange={setMoving}
          ticket={bill.ticket}
          count={pickedIds.length}
          allSelected={pickedIds.length >= movable.length}
          suggestedName={oneName(sent.filter((line) => picked?.has(toNumber(line.id))))}
          isPending={billLines.moving}
          onPick={movePicked}
        />
      )}
      <CustomerSearch
        open={naming}
        onOpenChange={setNaming}
        onPick={(who) => {
          void billLines.assign(pickedIds, who).then((done) => {
            if (!done) return
            // Somebody with an account named on a room's lines is in the room
            if (bill.stay && who.id && !roster.some((member) => member.id === who.id)) {
              stayActions.addMember(toNumber(bill.stay.id), who.id, who.name)
            }
            stopPicking()
          })
        }}
      />

      {/* Taking the money, over the order */}
      {bill.ticket && (
        <>
          <PayWhoSheet
            open={askingWho}
            onOpenChange={setAskingWho}
            title={title}
            total={leftToPay}
            payers={payers}
            partPaid={partPaid > 0}
            onEverything={() => {
              setAskingWho(false)
              setPaying(true)
            }}
            onPayer={payFor}
          />
          <PartPaymentSheet
            ticketId={toNumber(bill.ticket.id)}
            title={title}
            part={part}
            onOpenChange={(open) => !open && setPart(null)}
            onTaken={() => setPart(null)}
          />
          <BillPayment
            ticket={bill.ticket}
            title={title}
            stay={bill.stay}
            runningStay={bill.runningStay}
            open={paying}
            onOpenChange={setPaying}
            // A part split off for one person: back to the bill it came from, for the rest
            onPaid={() =>
              backTo ? navigate({ to: '/order/$ticketId', params: { ticketId: String(backTo) } }) : navigate({ to: '/' })
            }
          />
        </>
      )}
      {/* Blocking wait for a delivery or a call-centre order, which has no
          bill on this till to show itself on: nothing else may be touched
          until the server has it */}
      {order.busy && (
        <div className='bg-background/80 fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur-sm'>
          <Loader2 className='size-10 animate-spin' />
          <p className='text-lg font-semibold'>{order.busyText}</p>
        </div>
      )}
    </div>
  )
}
