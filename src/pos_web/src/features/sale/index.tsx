import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { createPosOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { getTicketOptions } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChooseCustomerButton,
  SelectedCustomer,
} from '@/features/customer/selected-customer'
import { useBranchName } from '@/features/branch/use-branch-name'
import { PhoneDeliveryForm } from '@/features/deliveries/phone-delivery-form'
import { useOfflineCharge } from '@/features/offline/offline-charge'
import { saveCustomerPreferences, startSend } from '@/features/sending/sending'
import { PriceReviewDialog } from './price-review-dialog'
import { sendToBranchId, toPosDeliveryRequest } from './sale-delivery'
import { SaleDeliverySummary } from './sale-delivery-summary'
import { useBranchPriceCheck, type PriceReview } from './use-branch-price-check'
import { useSaleDelivery } from './use-sale-delivery'
import { stayRoster } from '@/features/places/status'
import { useStay, useStayActions } from '@/features/places/use-places'
import { useCallCentre } from '@/hooks/use-call-centre'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { getActiveBranchId } from '@/stores/branch-store'
import { API_VERSION, apiClient } from '@/lib/api-client'
import { useTillItems } from '@/lib/brand'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { handleServerError } from '@/lib/handle-server-error'
import { isConnectionError, useNetworkStatus } from '@/lib/network-status'
import { toast } from '@/lib/toast'
import { toBasketItems } from './basket-items'
import {
  lineKey,
  saleCount,
  tillSuggestions,
  saleTotal,
  useSale,
  type SaleCustomer,
  type SaleLine,
} from './cart'
import { CustomerDialog } from './customer-dialog'
import { pendingTicketCustomerKey } from '@/features/floor/new-ticket-dialog'
import { cn } from '@/lib/utils'
import { CustomizeDialog } from './customize-dialog'
import { itemPictureUrl } from './item-picture'
import { ItemImage } from './item-image'

/** How long a charge waits for the server before the sale is taken offline */
const CHARGE_TIMEOUT_MS = 20_000
/** The attached customer's usuals, shown as a category of their own */
const USUALS_CATEGORY = -1

function ItemTile({
  item,
  onTap,
}: {
  item: CatalogItemDto
  onTap: (item: CatalogItemDto) => void
}) {
  const localized = useLocalized()
  const money = useMoney()

  return (
    <button
      type='button'
      disabled={item.isAvailable === false}
      onClick={() => onTap(item)}
      className='bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border text-start shadow-xs transition-colors active:scale-[0.98] disabled:opacity-40'
    >
      <div className='bg-muted flex aspect-[4/3] w-full items-center justify-center overflow-hidden md:aspect-square'>
        <ItemImage
          src={item.pictureUri ? itemPictureUrl(item.id) : null}
          className='h-full w-full'
        />
      </div>
      <div className='flex flex-col gap-0.5 p-2'>
        <span className='line-clamp-2 text-sm font-medium'>
          {localized(item.name)}
        </span>
        <span className='text-muted-foreground text-sm tabular-nums'>
          {money(item.effectivePrice ?? item.price)}
        </span>
      </div>
    </button>
  )
}

/**
 * The compact sale pad's tile, for a long menu: the name (two lines at most)
 * and the price, no picture, plain as the rest of the till.
 * The line keeps the till's direction; the name is isolated in it, so a
 * Latin name in an Arabic till starts where an Arabic one would.
 */
function CompactItemTile({
  item,
  onTap,
}: {
  item: CatalogItemDto
  onTap: (item: CatalogItemDto) => void
}) {
  const localized = useLocalized()
  const money = useMoney()

  return (
    <button
      type='button'
      disabled={item.isAvailable === false}
      onClick={() => onTap(item)}
      className='bg-card text-card-foreground flex min-h-16 flex-col justify-between gap-1 overflow-hidden rounded-lg border px-2.5 py-2 text-start shadow-xs transition-colors active:scale-[0.98] disabled:opacity-40'
    >
      <span className='line-clamp-2 text-sm leading-snug font-medium'>
        <bdi>{localized(item.name)}</bdi>
      </span>
      <span className='text-muted-foreground text-sm tabular-nums'>
        {money(item.effectivePrice ?? item.price)}
      </span>
    </button>
  )
}

/**
 * One category in the compact till's side list: its name (two lines at most,
 * a Latin one isolated so it starts where the line does) and how many items
 * it holds, the one open filled in.
 */
function RailCategory({
  label,
  count,
  active,
  icon,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  icon?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent text-foreground',
      )}
    >
      {icon}
      <span className='line-clamp-2 min-w-0 flex-1'>
        <bdi>{label}</bdi>
      </span>
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums',
          active ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function CartLineRow({
  line,
  onSetQuantity,
}: {
  line: SaleLine
  onSetQuantity: (key: string, quantity: number) => void
}) {
  const language = useLanguage((s) => s.language)
  const money = useMoney()

  const key = lineKey(line)
  // A business may write its menu in one language only: each name falls back to the other
  const name =
    (language === 'ar' ? line.nameAr : line.nameEn) ||
    line.nameEn ||
    line.nameAr
  const optionsLabel = line.customizations
    .map(
      (c) =>
        (language === 'ar' ? c.optionNameAr : c.optionNameEn) ||
        c.optionNameEn ||
        c.optionNameAr ||
        '',
    )
    .join(' · ')

  return (
    <div className='flex items-start gap-2 px-3 py-2'>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{name}</div>
        {optionsLabel && (
          <div className='text-muted-foreground truncate text-xs'>
            {optionsLabel}
          </div>
        )}
        {line.specialInstructions && (
          <div className='text-muted-foreground truncate text-xs italic'>
            "{line.specialInstructions}"
          </div>
        )}
        <div className='mt-1.5 flex items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            className='size-9 rounded-full'
            aria-label='Decrease'
            onClick={() => onSetQuantity(key, line.quantity - 1)}
          >
            {line.quantity === 1 ? (
              <Trash2 className='text-destructive size-4' />
            ) : (
              <Minus className='size-4' />
            )}
          </Button>
          <span className='w-6 text-center text-sm font-semibold tabular-nums'>
            {line.quantity}
          </span>
          <Button
            variant='outline'
            size='icon'
            className='size-9 rounded-full'
            aria-label='Increase'
            onClick={() => onSetQuantity(key, line.quantity + 1)}
          >
            <Plus className='size-4' />
          </Button>
        </div>
      </div>
      <span className='shrink-0 text-sm font-semibold tabular-nums'>
        {money(line.price * line.quantity)}
      </span>
    </div>
  )
}

/**
 * The item pad: category tabs + item grid on the start side, the running
 * sale on the end side. Charging posts a POS order (the kitchen sees it like
 * any other order), waits for the counter ticket it lands on, then jumps
 * straight into the settle dialog — the walk-in pays on the spot.
 *
 * Given a `ticketId` it is the same pad against a bill that is already on
 * the floor: the order names that ticket, so Sales appends to it instead of
 * opening a counter one, and the cashier lands back on the ticket with
 * nothing to pay yet.
 */
function readLastCustomer(
  key: string | null,
): { id: string; name: string } | null {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { id: string; name: string }) : null
  } catch {
    return null
  }
}

export function SalePad({ ticketId }: { ticketId?: number }) {
  const addingToTicket = ticketId !== undefined
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // The owner's choice in admin: photo tiles, or text tiles for a long menu
  const compact = useTillItems() === 'compact'

  const {
    lines,
    note,
    customer,
    add,
    setQuantity,
    setNote,
    setCustomer,
    setTarget,
    target,
    clear,
  } = useSale()

  // A walk-in sale can go out with a rider instead (use-sale-delivery)
  const saleDelivery = useSaleDelivery(addingToTicket)
  const { delivery, delivering } = saleDelivery
  const deliveryFee = saleDelivery.fee
  // Sent to the branch nearer the caller: its menu is checked first, and the
  // order goes there with nothing on this branch's bills
  const sendTo = sendToBranchId(delivery)
  const branchName = useBranchName()
  const priceCheck = useBranchPriceCheck()
  // Taken at the call centre: nothing is paid here, and the next caller follows
  const callCentre = useCallCentre().on
  const [priceReview, setPriceReview] = useState<PriceReview | null>(null)

  // Before paint, so the cashier never sees the previous destination's cart
  useLayoutEffect(() => {
    setTarget(ticketId ?? null)
  }, [ticketId, setTarget])

  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(
    null,
  )
  // Opened from a suggestion: what it adds says so
  const [customizeSuggested, setCustomizeSuggested] = useState(false)
  // The item rung up last: what it goes well with is offered under the sale
  const [lastAdded, setLastAdded] = useState<CatalogItemDto | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  // On a phone the running order lives in a sheet under the menu, opened
  // from the bar along the bottom; a tablet keeps it beside the menu
  const isMobile = useIsMobile()
  const [orderOpen, setOrderOpen] = useState(false)
  // A phone shows one category's chips at a time, so a name typed in is the
  // quicker way to an item than scrolling the row
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Adding to a room's bill: the people in the room are the first choice
  // for whose round this is, and somebody picked from the search who is not
  // in the room yet joins the roster right here — the cashier is telling us
  // they are there, and their share of the time will need a tab at settle
  const ticketQuery = useQuery({
    ...getTicketOptions({
      path: { id: ticketId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: addingToTicket,
  })
  const roomSession = useStay(
    ticketQuery.data?.sessionId,
    ticketQuery.data?.sessionId != null,
  )
  const roster = stayRoster(roomSession)
  const ownerId = (roomSession?.members ?? []).find(
    (m) => m.role === 'Owner',
  )?.customerId
  const sessionId = roomSession?.id != null ? Number(roomSession.id) : null
  const lastKey =
    sessionId != null ? `pos.session.${sessionId}.lastCustomer` : null
  const sessionActions = useStayActions()
  const rememberLast = (picked: SaleCustomer) => {
    if (!lastKey || !picked.id) return
    try {
      localStorage.setItem(
        lastKey,
        JSON.stringify({ id: picked.id, name: picked.name }),
      )
    } catch {
      // A browser that refuses storage just loses the convenience
    }
  }
  const pickCustomer = (picked: SaleCustomer) => {
    setCustomer(picked)
    rememberLast(picked)
    if (roomSession && picked.id && !roster.some((m) => m.id === picked.id)) {
      sessionActions.addMember(toNumber(roomSession.id), picked.id, picked.name)
    }
  }

  // Pre-select the ticket's customer once, so adding items to someone's open
  // bill keeps going onto their account without re-asking. The lines' single
  // account wins; failing that, a room with a single member. Nobody, or more
  // than one person, leaves it to the cashier to say whose round it is.
  const prefilledForRef = useRef<number | null>(null)
  useEffect(() => {
    if (!addingToTicket || ticketId === undefined) return
    if (prefilledForRef.current === ticketId) return
    const ticket = ticketQuery.data
    if (!ticket || target !== ticketId) return
    prefilledForRef.current = ticketId
    if (customer || lines.length > 0) return
    // A tab opened for an account (the new-tab dialog) pre-selects them so
    // the round lands on their tab. One-shot: read once, then cleared.
    try {
      const raw = localStorage.getItem(pendingTicketCustomerKey(ticketId))
      if (raw) {
        localStorage.removeItem(pendingTicketCustomerKey(ticketId))
        const pendingCustomer = JSON.parse(raw) as SaleCustomer
        if (pendingCustomer?.id) {
          setCustomer(pendingCustomer)
          return
        }
      }
    } catch {
      // No stored pre-selection; fall through to deriving from the bill
    }
    const byId = new Map<string, string>()
    for (const line of ticket.lines ?? []) {
      if (line.customerId)
        byId.set(String(line.customerId), line.customerName ?? '')
    }
    let only: SaleCustomer | null = null
    if (byId.size === 1) {
      // Everything on the bill is one person's — keep going onto them
      const [id, name] = [...byId.entries()][0]
      only = { id, name }
    } else if (byId.size === 0 && roster.length >= 1) {
      // Nothing tagged yet: the person the last round went to, else the owner,
      // else the only member. More than one already-billed person → don't guess.
      const remembered = readLastCustomer(lastKey)
      const pick =
        (remembered && roster.find((m) => m.id === remembered.id)) ||
        (ownerId && roster.find((m) => m.id === ownerId)) ||
        (roster.length === 1 ? roster[0] : null)
      if (pick) only = { id: pick.id, name: pick.name }
    }
    if (only) setCustomer(only)
  }, [
    addingToTicket,
    ticketId,
    ticketQuery.data,
    target,
    customer,
    lines.length,
    roster,
    ownerId,
    lastKey,
    setCustomer,
  ])

  const { data: categories = [] } = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } }),
  )
  const { data: items = [], isLoading: itemsLoading } = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } }),
  )

  // The attached customer's most-ordered items, ranked. A walk-in (no id) or a
  // customer without enough history gets nothing; the chip then hides.
  const { data: usualIds = [] } = useQuery({
    queryKey: ['customerTopItems', customer?.id],
    queryFn: async () => {
      const response = await apiClient.get<number[]>(
        `/api/catalog/customers/${customer!.id}/top-items`,
      )
      return response.data
    },
    enabled: !!customer?.id,
    staleTime: 60_000,
  })
  const itemsById = new Map(items.map((i) => [Number(i.id), i]))
  const usualItems = customer?.id
    ? usualIds
        .map((id) => itemsById.get(Number(id)))
        .filter((i): i is CatalogItemDto => !!i && i.isAvailable !== false)
        .slice(0, 8)
    : []

  // Their usuals are a category of their own, first in the row and open by
  // default while they are attached — never a second copy of an item above
  // the category it also lives in
  const customerId = customer?.id
  useEffect(() => {
    setActiveCategory(null)
  }, [customerId])
  const sortedCategories = categories
    .slice()
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const firstCategoryId =
    sortedCategories.length > 0 ? toNumber(sortedCategories[0].id) : null
  const hasUsuals = usualItems.length > 0
  const activeCategoryId =
    activeCategory === null
      ? hasUsuals
        ? USUALS_CATEGORY
        : firstCategoryId
      : activeCategory === USUALS_CATEGORY && !hasUsuals
        ? firstCategoryId
        : activeCategory
  // A long menu on a tablet (compact) lists its categories down the side
  // instead of rows of chips over the items, with the search always in view
  const rail = compact && !isMobile
  const needle = searchOpen || rail ? searchTerm.trim().toLowerCase() : ''
  const countIn = new Map<number, number>()
  for (const item of items) {
    const id = toNumber(item.catalogTypeId)
    countIn.set(id, (countIn.get(id) ?? 0) + 1)
  }
  const pickCategory = (id: number) => {
    setActiveCategory(id)
    // Picking a category leaves the search: the rail's list is the way in now
    if (rail) setSearchTerm('')
  }
  const visibleItems = needle
    ? items.filter(
        (item) =>
          (item.name?.en ?? '').toLowerCase().includes(needle) ||
          (item.name?.ar ?? '').toLowerCase().includes(needle),
      )
    : activeCategoryId === USUALS_CATEGORY
      ? usualItems
      : items
          .filter((item) => toNumber(item.catalogTypeId) === activeCategoryId)
          .sort(
            (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0),
          )

  const itemsTotal = saleTotal(lines)
  const total = itemsTotal + deliveryFee
  const count = saleCount(lines)

  const tapItem = (item: CatalogItemDto, suggested = false) => {
    if (item.customizations?.length) {
      setCustomizeSuggested(suggested)
      setCustomizeItem(item)
      return
    }
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: toNumber(item.effectivePrice ?? item.price),
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: 1,
      customizations: [],
      suggestion: suggested ? 'Till' : undefined,
    })
    // A suggestion taken leaves the offer as it was: it never brings on its own
    if (!suggested) setLastAdded(item)
  }

  // Nothing on the sale, nothing to go with
  const suggestions = lines.length === 0 ? [] : tillSuggestions(lastAdded, items, lines)

  // Idempotency mirror of client_web/cart: the request id must survive
  // retries of the SAME sale, so a resubmit after a timeout (where the
  // server actually processed the first attempt) is deduplicated instead of
  // ringing the customer up twice. A new id is only issued when the sale
  // content changes.
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)

  /** The request id for charging these lines: the last one's, for the same sale */
  const requestIdFor = (toSend: SaleLine[]) => {
    const signature = JSON.stringify({
      lines: toSend.map((line) => [
        line.productId,
        line.quantity,
        line.specialInstructions,
        line.customizations.map((c) => [c.customizationId, c.optionId]),
      ]),
      note: note.trim(),
      // Attaching (or removing) a customer makes it a different sale, not a
      // retry of the previous one — a bare name counts too
      customer: customer?.id ?? customer?.name ?? null,
      // The same items against a different bill are a different sale too
      ticket: ticketId ?? null,
      // And sent somewhere else, another sale again
      delivery,
    })
    if (!requestIdRef.current || requestIdRef.current.signature !== signature) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }
    return requestIdRef.current.id
  }

  // With the server out of reach, a counter sale is still taken: priced
  // here, paid here, printed here, and sent once the server is back
  // (features/offline). Anything that needs the server's say first waits.
  const online = useNetworkStatus((s) => s.online)
  const offlineCharge = useOfflineCharge()
  const sellsOffline =
    !addingToTicket && !delivering && !callCentre && sendTo == null && !customer?.id
  const chargeOffline = () => {
    if (!sellsOffline) {
      toast.warning(t('needsInternet'))
      return
    }
    offlineCharge.start({
      // The id an online attempt already used: if that one did land after
      // all, the replay is recognised as it rather than sold twice
      requestId: requestIdFor(lines),
      lines,
      note,
      customerName: customer?.name.trim() || null,
      onQueued: () => {
        requestIdRef.current = null
        clear()
      },
    })
  }

  const placeOrder = useMutation({
    ...createPosOrderMutation(),
    onError: (error) => {
      // No answer at all: the server is out of reach, and this is how the
      // till usually finds out — the sale is taken offline instead
      if (isConnectionError(error)) chargeOffline()
      else handleServerError(error)
    },
    onSuccess: (data) => {
      // Save the attached customer's choices before the cart is cleared below
      if (customer?.id) saveCustomerPreferences(customer.id, lines)
      // The order landed — the next charge is a new logical request
      requestIdRef.current = null
      const orderId = toNumber(data.orderId)

      // A delivery is a bill of its own, settled when the rider's cash comes
      // in: nothing to pay now, and the rider is picked on the floor
      if (delivering) {
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveries' }] })
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        toast.success(
          orderId === 0
            ? t('orderAlreadyPlaced')
            : sendTo != null
              ? t('deliverySentTo', { branch: branchName(sendTo), orderId })
              : t('deliveryPlaced'),
        )
        navigate({ to: '/' })
        return
      }

      // A caller collecting at the branch: their bill waits at its counter,
      // paid when they come for it; the call centre takes the next call
      if (callCentre) {
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        toast.success(
          orderId === 0
            ? t('orderAlreadyPlaced')
            : t('callCentrePickupPlaced', { branch: branchName(getActiveBranchId()), orderId }),
        )
        navigate({ to: '/' })
      }
    },
  })

  const charge = () => {
    if (!online) {
      chargeOffline()
      return
    }
    // A delivery waits for its terms: it never goes out as a counter sale
    if (delivering && saleDelivery.readiness !== 'ready') return
    // A rider needs a name at the door: taken off the sale, it is asked again
    if (delivering && !customer?.name.trim()) {
      saleDelivery.setFormOpen(true)
      return
    }
    // The blocking "sending" wait paints under an open sheet otherwise
    setOrderOpen(false)
    if (sendTo != null) {
      // The other branch's menu first: its prices, and what it ran out of
      priceCheck
        .check(sendTo, lines)
        .then((review) => (review.items.length === 0 ? send(lines) : setPriceReview(review)))
        .catch(() => toast.error(t('priceCheckFailed', { branch: branchName(sendTo) })))
      return
    }
    send(lines)
  }

  /** Places the order with these lines: the cart's, or the other branch's prices of them */
  const send = (toSend: SaleLine[]) => {
    const requestId = requestIdFor(toSend)
    const body = {
      items: toBasketItems(toSend),
      customerNote: note.trim() || null,
      // No place: a counter sale settles at the till. When the
      // cashier is adding to an open bill, the ticket is named outright —
      // Sales appends to it instead of inferring a destination.
      ticketId: ticketId ?? null,
      // The account, only when there is one: it is what loyalty accrues to
      // and what an on-account settle charges
      customerUserId: customer?.id ?? null,
      customerUserName: customer?.id ? customer.name : null,
      // The name always travels, account or not — the kitchen card and the
      // bill line both carry it
      customerName: customer?.name ?? null,
      // Redemption at the counter is a later phase; accrual happens
      // server-side off the attached customer
      pointsToRedeem: 0,
      // Where it goes; the pin only when the caller shared one
      delivery: delivery ? toPosDeliveryRequest(delivery) : null,
      // The branch nearer the caller that makes and delivers it
      sendToBranchId: sendTo,
    }

    // Onto an open bill, or a walk-in's new one: the bill shows the lines
    // at once, faded until the server has them, and the till is free for
    // the next thing (features/sending)
    if (!delivering && !callCentre) {
      const target = ticketId ?? null
      void startSend({
        requestId,
        ticketId: target,
        branchId: getActiveBranchId(),
        lines: toSend,
        note,
        customer,
        body,
      }).then((outcome) => {
        if (outcome.kind === 'alreadyPlaced') toast.info(t('orderAlreadyPlaced'))
        if (outcome.kind !== 'failed') {
          queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
          queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        }
      })
      requestIdRef.current = null
      clear()
      if (target != null) {
        navigate({ to: '/ticket/$ticketId', params: { ticketId: String(target) } })
      } else {
        navigate({ to: '/ticket/sending/$requestId', params: { requestId } })
      }
      return
    }

    placeOrder.mutate({
      body,
      headers: { 'x-requestid': requestId },
      query: { 'api-version': API_VERSION },
      // A line that has gone quiet answers nothing for minutes: past this,
      // the sale is taken offline (and the same request id keeps a late
      // arrival from becoming a second sale)
      timeout: CHARGE_TIMEOUT_MS,
    })
  }

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft
  const SaleHeading = isMobile ? SheetTitle : 'h2'

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchTerm('')
  }

  // Compact packs the row by the menu's own width, not the screen's: six
  // across beside the order on a 1280 till, eight on a 1920 one
  const itemGrid = (tiles: ReactNode) =>
    compact ? (
      <div className='@container'>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 @3xl:grid-cols-6 @5xl:grid-cols-7 @7xl:grid-cols-8'>
          {tiles}
        </div>
      </div>
    ) : (
      <div className='grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3'>
        {tiles}
      </div>
    )
  const Tile = compact ? CompactItemTile : ItemTile

  // The running sale: beside the menu on a tablet, in the bottom sheet on a
  // phone — the same parts either way, so nothing is out of reach on either
  const orderPanel = (
    <>
      {/* Built like the item pad's search row (py-2, a size-12 button), so
          the two rules under them meet in one line */}
      <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2 max-md:pe-14'>
        <SaleHeading className='flex min-w-0 flex-1 items-baseline gap-2 text-lg font-bold'>
          <span className='truncate'>{t('currentSale')}</span>
          {count > 0 && (
            <span className='text-muted-foreground shrink-0 text-sm font-medium'>
              {t('linesCount', { count })}
            </span>
          )}
        </SaleHeading>
        <Button
          variant='ghost'
          size='icon'
          className='size-12'
          aria-label={t('clearSale')}
          disabled={lines.length === 0 && !customer && !note && !delivery}
          onClick={clear}
        >
          <Trash2 className='size-5' />
        </Button>
      </div>

      <div className='border-b p-3'>
        {addingToTicket && roomSession && roster.length >= 2 && (
          <div className='mb-2 flex flex-col gap-1.5'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('whoseRound')}
            </span>
            <div className='flex flex-wrap gap-2'>
              {roster.map((m) => (
                <button
                  key={m.id}
                  type='button'
                  onClick={() => pickCustomer({ id: m.id, name: m.name })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm max-md:min-h-11 max-md:px-4',
                    customer?.id === m.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background',
                  )}
                >
                  {m.name || t('guest')}
                </button>
              ))}
              <button
                type='button'
                onClick={() => setCustomerOpen(true)}
                className='text-muted-foreground flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm max-md:min-h-11 max-md:px-4'
              >
                <UserPlus className='size-4' />
                {t('someoneElse')}
              </button>
            </div>
          </div>
        )}
        {customer ? (
          <SelectedCustomer
            customer={customer}
            onRemove={() => setCustomer(null)}
          />
        ) : addingToTicket && roomSession && roster.length >= 2 ? null : (
          <ChooseCustomerButton onClick={() => setCustomerOpen(true)} />
        )}
        {delivery ? (
          <SaleDeliverySummary
            delivery={delivery}
            readiness={saleDelivery.readiness}
            onEdit={() => saleDelivery.setFormOpen(true)}
            onRemove={saleDelivery.remove}
            onRetry={saleDelivery.retry}
          />
        ) : (
          saleDelivery.canOffer && (
            <Button
              variant='outline'
              className='mt-2 h-12 w-full gap-2 text-base'
              onClick={() => saleDelivery.setFormOpen(true)}
            >
              <Bike className='size-5' />
              {t('deliverIt')}
            </Button>
          )
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {lines.length === 0 ? null : (
          <div className='flex flex-col divide-y'>
            {lines.map((line) => (
              <CartLineRow
                key={lineKey(line)}
                line={line}
                onSetQuantity={setQuantity}
              />
            ))}
          </div>
        )}
      </div>

      {/* What the item rung up last goes well with: one tap to offer it */}
      {suggestions.length > 0 && (
        <div className='border-t px-3 pt-2 pb-1'>
          <div className='text-muted-foreground mb-1.5 text-xs font-medium'>
            {t('goesWellWith')}
          </div>
          <div className='no-scrollbar flex gap-2 overflow-x-auto pb-1'>
            {suggestions.map((item) => (
              <Button
                key={String(item.id)}
                variant='outline'
                className='h-10 shrink-0 gap-1.5 px-3'
                onClick={() => tapItem(item, true)}
              >
                <Plus className='size-4' />
                {localized(item.name)}
                <span className='text-muted-foreground tabular-nums'>
                  {money(toNumber(item.effectivePrice ?? item.price))}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3 border-t p-3'>
        {delivering && (
          <div className='text-muted-foreground flex justify-between text-sm'>
            <span>{t('deliveryFee')}</span>
            <span className='tabular-nums'>
              {deliveryFee > 0 ? money(deliveryFee) : t('deliveryFree')}
            </span>
          </div>
        )}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('orderNoteOptional')}
          className='h-12 text-base'
          autoComplete='off'
        />
        <Button
          size='lg'
          className='h-14 w-full justify-between px-5 text-lg'
          disabled={
            lines.length === 0 ||
            placeOrder.isPending ||
            // A delivery waits for its terms rather than going out as a counter sale
            (delivering && saleDelivery.readiness !== 'ready')
          }
          onClick={charge}
        >
          <span>
            {addingToTicket
              ? t('addToTicket')
              : delivering
                ? t('deliverySend')
                : t('chargeAction')}
          </span>
          <span className='tabular-nums'>{money(total)}</span>
        </Button>
      </div>
    </>
  )

  return (
    <div className='flex h-[calc(100svh-4rem)]'>
      {/* ----- item pad ----- */}
      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='flex items-center gap-2 border-b p-2'>
          <Button
            asChild
            variant='ghost'
            size='icon'
            className='size-12 shrink-0'
          >
            {addingToTicket ? (
              <Link
                to='/ticket/$ticketId'
                params={{ ticketId: String(ticketId) }}
                aria-label={t('backToTicket')}
              >
                <BackIcon className='size-6' />
              </Link>
            ) : (
              <Link to='/' aria-label={t('backToFloor')}>
                <BackIcon className='size-6' />
              </Link>
            )}
          </Button>
          {searchOpen || rail ? (
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2' />
              <Input
                autoFocus={!rail}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchItems')}
                className='h-11 ps-9 text-base'
                autoComplete='off'
                enterKeyHint='search'
              />
            </div>
          ) : (
            /* A tablet sees every category: the chips wrap into rows rather
               than scrolling sideways behind a scrollbar. A phone has no
               room for rows of chips above the menu, so there they are one
               row that swipes, each chip snapping to the edge. */
            <div className='no-scrollbar flex min-w-0 flex-1 gap-2 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-1 max-md:overflow-x-auto max-md:px-1 md:flex-wrap'>
              {hasUsuals && (
                <Button
                  variant={
                    activeCategoryId === USUALS_CATEGORY ? 'default' : 'outline'
                  }
                  className='h-11 shrink-0 snap-start px-4 text-base'
                  onClick={() => setActiveCategory(USUALS_CATEGORY)}
                >
                  <Sparkles className='size-4' />
                  {t('usuals')}
                </Button>
              )}
              {sortedCategories.map((category) => {
                const id = toNumber(category.id)
                return (
                  <Button
                    key={id}
                    variant={id === activeCategoryId ? 'default' : 'outline'}
                    className='h-11 shrink-0 snap-start px-4 text-base'
                    onClick={() => setActiveCategory(id)}
                  >
                    {localized(category.name)}
                  </Button>
                )
              })}
            </div>
          )}
          {/* Search is the phone's shortcut past the one-row chips; a
              tablet has every category in view already */}
          <Button
            variant='ghost'
            size='icon'
            className='size-11 shrink-0 md:hidden'
            aria-label={searchOpen ? t('clear') : t('searchItems')}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            {searchOpen ? (
              <X className='size-5' />
            ) : (
              <Search className='size-5' />
            )}
          </Button>
        </div>

        <div className='flex min-h-0 flex-1'>
          {rail && (
            <nav
              aria-label={t('categories')}
              className='flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-e p-2'
            >
              {hasUsuals && (
                <RailCategory
                  active={!needle && activeCategoryId === USUALS_CATEGORY}
                  onClick={() => pickCategory(USUALS_CATEGORY)}
                  label={t('usuals')}
                  count={usualItems.length}
                  icon={<Sparkles className='size-4 shrink-0' />}
                />
              )}
              {sortedCategories.map((category) => {
                const id = toNumber(category.id)
                return (
                  <RailCategory
                    key={id}
                    active={!needle && id === activeCategoryId}
                    onClick={() => pickCategory(id)}
                    label={localized(category.name)}
                    count={countIn.get(id) ?? 0}
                  />
                )
              })}
            </nav>
          )}
          <div className='min-w-0 flex-1 overflow-y-auto p-3'>
          {itemsLoading ? (
            itemGrid(
              Array.from({ length: compact ? 24 : 8 }).map((_, i) =>
                compact ? (
                  /* Name and price lines, no picture — the compact tile's shape */
                  <div
                    key={i}
                    className='flex min-h-16 flex-col justify-between gap-1.5 rounded-lg border px-2.5 py-2 shadow-xs'
                  >
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                ) : (
                  <div
                    key={i}
                    className='flex flex-col overflow-hidden rounded-xl border shadow-xs'
                  >
                    {/* Picture, then name and price lines — the item tile's shape */}
                    <Skeleton className='aspect-[4/3] w-full rounded-none md:aspect-square' />
                    <div className='flex flex-col gap-1.5 p-2'>
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-3 w-1/2' />
                    </div>
                  </div>
                ),
              ),
            )
          ) : visibleItems.length === 0 ? (
            <p className='text-muted-foreground py-16 text-center'>
              {needle ? t('noItemsMatch') : t('noItemsInCategory')}
            </p>
          ) : (
            itemGrid(
              visibleItems.map((item) => (
                <Tile key={String(item.id)} item={item} onTap={tapItem} />
              )),
            )
          )}
          </div>
        </div>

        {/* The phone's way to the order: always on screen under the menu,
            reading what is in it and what it comes to */}
        {isMobile && (
          <div className='border-t p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]'>
            <Button
              size='lg'
              className='h-14 w-full justify-between gap-3 px-4 text-base'
              onClick={() => setOrderOpen(true)}
            >
              <span className='flex min-w-0 items-center gap-2'>
                {count > 0 && (
                  <span className='bg-primary-foreground text-primary flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums'>
                    {count}
                  </span>
                )}
                <span className='truncate font-semibold'>
                  {t('viewOrder')}
                </span>
              </span>
              <span className='shrink-0 text-lg font-semibold tabular-nums'>
                {money(total)}
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* ----- running sale ----- */}
      {isMobile ? (
        <Sheet open={orderOpen} onOpenChange={setOrderOpen}>
          <SheetContent
            aria-describedby={undefined}
            className='h-[calc(100svh-2.5rem)]'
          >
            {orderPanel}
          </SheetContent>
        </Sheet>
      ) : (
        <aside className='flex w-[340px] shrink-0 flex-col border-s xl:w-[380px]'>
          {orderPanel}
        </aside>
      )}

      <CustomizeDialog
        item={customizeItem}
        customerId={customer?.id ?? null}
        onOpenChange={(open) => !open && setCustomizeItem(null)}
        onAdd={(line) => {
          add(customizeSuggested ? { ...line, suggestion: 'Till' } : line)
          if (!customizeSuggested) setLastAdded(customizeItem)
          setCustomizeItem(null)
        }}
      />
      <PhoneDeliveryForm
        open={saleDelivery.formOpen}
        onOpenChange={saleDelivery.setFormOpen}
        initial={delivery}
        customer={customer}
        itemsTotal={itemsTotal}
        onSave={saleDelivery.save}
      />
      <PriceReviewDialog
        review={priceReview}
        branch={branchName(sendTo)}
        onClose={() => setPriceReview(null)}
        onUse={(adjusted) => {
          setPriceReview(null)
          send(adjusted)
        }}
        onKeepHere={() => {
          // Made here after all: the cashier charges again, at this branch's fee
          setPriceReview(null)
          if (delivery) saleDelivery.keepHere()
        }}
      />
      {offlineCharge.element}
      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onSelect={pickCustomer}
        quickPicks={roster}
      />

      {/* Blocking wait for a delivery or a call-centre order, which has no
          bill on this till to show itself on: nothing else may be touched
          until the server has it */}
      {(placeOrder.isPending || priceCheck.checking) && (
        <div className='bg-background/80 fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur-sm'>
          <Loader2 className='size-10 animate-spin' />
          <p className='text-lg font-semibold'>
            {priceCheck.checking ? t('priceChecking', { branch: branchName(sendTo) }) : t('sendingToKitchen')}
          </p>
        </div>
      )}
    </div>
  )
}
