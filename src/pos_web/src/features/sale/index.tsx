import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Ellipsis,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { createPosOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChooseCustomerButton,
  SelectedCustomer,
} from '@/features/customer/selected-customer'
import { useBranchName } from '@/features/branch/use-branch-name'
import { customerName, ensureCounterCustomer } from '@/features/customer/counter-customers'
import { PhoneDeliveryForm } from '@/features/deliveries/phone-delivery-form'
import { useDeliveryActions } from '@/features/deliveries/use-deliveries'
import { useOfflineCharge } from '@/features/offline/offline-charge'
import { saveCustomerPreferences, startSend } from '@/features/sending/sending'
import { PriceReviewDialog } from './price-review-dialog'
import { sendToBranchId, toPosDeliveryRequest } from './sale-delivery'
import { SaleDeliverySummary } from './sale-delivery-summary'
import { OrderTypeSwitch } from './order-type-switch'
import { useBranchPriceCheck, type PriceReview } from './use-branch-price-check'
import { useSaleDelivery } from './use-sale-delivery'
import { useOpenBill } from './use-open-bill'
import { billLabel } from '@/features/deliveries/delivery-format'
import { StayStrip } from '@/features/places/stay-strip'
import { stayRoster } from '@/features/places/status'
import { useStayActions } from '@/features/places/use-places'
import { totalWith } from '@/features/sending/bill'
import { SendingLines } from '@/features/sending/sending-lines'
import { LineRow, mergeIdenticalLines } from '@/features/ticket/bill-lines'
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

/** The same person: by their account when they have one, else by the name the till was told */
const samePerson = (a: SaleCustomer | null, b: SaleCustomer) =>
  !!a && (a.id || b.id ? a.id === b.id : a.name.trim() === b.name.trim())

/** A quiet heading over a part of the bill: what is on it already, what is new */
function SectionLabel({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <div
      className={cn(
        'px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase',
        accent ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </div>
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
    add: addToSale,
    setQuantity,
    setNote,
    setCustomer,
    setTarget,
    target,
    clear,
  } = useSale()

  // A walk-in sale can go out with a rider instead (use-sale-delivery)
  const saleDelivery = useSaleDelivery(addingToTicket)
  const deliveryActions = useDeliveryActions()
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
  // A new caller is being added to the customers, a moment before their order goes
  const [addingCaller, setAddingCaller] = useState(false)

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
  // The bill itself is on this screen: what is on it already, what was just
  // charged and is on its way, and the room's clock (use-open-bill)
  const bill = useOpenBill(ticketId)
  const ticketQuery = bill.query
  const roomSession = bill.stay
  const billLines = bill.ticket?.lines ?? []
  // The bill went (discarded under the screen): back to the floor. Paid or
  // voided: nothing more is rung onto it, its own page says the rest
  useEffect(() => {
    if (bill.gone) navigate({ to: '/' })
    else if (bill.closed && ticketId !== undefined)
      navigate({ to: '/ticket/$ticketId', params: { ticketId: String(ticketId) }, replace: true })
  }, [bill.gone, bill.closed, ticketId, navigate])
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
    } else if (byId.size > 1) {
      // Several people on the bill: the one the last round went to is the
      // likeliest for the next, and the others are a tap away under the box
      const last = [...(ticket.lines ?? [])].reverse().find((l) => l.customerId)
      if (last) only = { id: String(last.customerId), name: last.customerName ?? '' }
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
  // An open bill's name (the table, the room, the tab) and what it comes to
  // with the lines on their way and the ones being rung up now
  const billTitle = bill.ticket
    ? localized(bill.ticket.locationName) ||
      billLabel(bill.ticket.label).text ||
      t(bill.ticket.type === 'Room' ? 'room' : bill.ticket.type === 'Table' ? 'table' : 'counter')
    : ''
  const billTotal = bill.ticket
    ? totalWith(bill.ticket, bill.onTheirWay.reduce((sum, x) => sum + saleTotal(x.lines), 0) + itemsTotal)
    : null

  // Everyone this bill already knows: the room's people, and whoever earlier
  // rounds were rung up for (an account, or a name the till was told), with
  // the one picked now when they are new to it
  const billPeople: SaleCustomer[] = []
  const addPerson = (p: SaleCustomer) => {
    if (!billPeople.some((x) => samePerson(x, p))) billPeople.push(p)
  }
  for (const m of roster) addPerson({ id: m.id, name: m.name })
  for (const line of billLines) {
    if (line.customerId) addPerson({ id: String(line.customerId), name: line.customerName ?? '' })
    else if (line.customerName) addPerson({ id: null, name: line.customerName })
  }
  // The ones a tap changes the round to: everyone but who it is for now
  const otherPeople = billPeople.filter((p) => !samePerson(customer, p))

  // A phone shows the menu first; a bill with something on it opens on the
  // bill instead, as its own page did. Once per bill
  const openedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!isMobile || ticketId === undefined || !bill.ticket || openedFor.current === ticketId) return
    openedFor.current = ticketId
    if ((bill.ticket.lines ?? []).length > 0) setOrderOpen(true)
  }, [isMobile, ticketId, bill.ticket])

  // The sale's rows by line, so the one just rung up can be scrolled to
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  // How many times each line has been rung up here, so its row's tint starts
  // again on every tap, as a line landing on the bill does
  const [rungUp, setRungUp] = useState<Record<string, number>>({})

  /** Adds the line and brings its row into view: a new line lands at the end
   * of a long sale, an extra one of a line already there anywhere in it */
  const add = (line: SaleLine) => {
    addToSale(line)
    const key = lineKey(line)
    setRungUp((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }))
    // Two frames: the row is rendered by the first, laid out by the second
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        rowRefs.current
          .get(key)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      ),
    )
  }

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
      // in: nothing to pay now. The rider picked in the form is given it at
      // once; without one it is given from Deliveries on the floor
      if (delivering) {
        const rider = sendTo == null && orderId !== 0 ? (delivery?.rider ?? null) : null
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveries' }] })
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        if (rider) deliveryActions.assign(orderId, rider.userId)
        toast.success(
          orderId === 0
            ? t('orderAlreadyPlaced')
            : sendTo != null
              ? t('deliverySentTo', { branch: branchName(sendTo), orderId })
              : rider
                ? t('deliveryPlacedRider', { name: rider.name })
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
        // The bill is this screen: the lines just charged show on it, faded
        // until the server has them, and the next round can be rung up at once.
        // The customer stays: the next round is most likely theirs too
        if (customer) setCustomer(customer)
      } else {
        navigate({ to: '/ticket/sending/$requestId', params: { requestId } })
      }
      return
    }

    const place = (as: typeof body) =>
      placeOrder.mutate({
        body: as,
        headers: { 'x-requestid': requestId },
        query: { 'api-version': API_VERSION },
        // A line that has gone quiet answers nothing for minutes: past this,
        // the sale is taken offline (and the same request id keeps a late
        // arrival from becoming a second sale)
        timeout: CHARGE_TIMEOUT_MS,
      })

    // A caller with no account yet becomes a customer as their order goes:
    // the number is the customer, so the next call finds them, with their
    // points and what they ordered. Never holds the order up: when it cannot
    // be done the order goes as a guest's
    const callerPhone = delivery?.phone || customer?.phone || ''
    if (!customer?.id && customer?.name.trim() && callerPhone) {
      setAddingCaller(true)
      void ensureCounterCustomer(customer.name.trim(), callerPhone)
        .then((added) => {
          if (!added) return place(body)
          const name = customerName(added) || customer.name
          setCustomer({ id: added.id, name, phone: added.phoneNumber ?? callerPhone })
          place({ ...body, customerUserId: added.id, customerUserName: name })
        })
        .finally(() => setAddingCaller(false))
      return
    }
    place(body)
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
          {/* An open bill is named for where it is: the table, the room, the tab */}
          <span className='truncate'>{addingToTicket ? billTitle : t('currentSale')}</span>
          {addingToTicket ? (
            <span className='text-muted-foreground shrink-0 text-sm font-medium tabular-nums' dir='ltr'>
              #{ticketId}
            </span>
          ) : (
            count > 0 && (
              <span className='text-muted-foreground shrink-0 text-sm font-medium'>
                {t('linesCount', { count })}
              </span>
            )
          )}
        </SaleHeading>
        {/* The rest a bill can do (discount, split, print, void) lives on its own page */}
        {addingToTicket && (
          <Button asChild variant='ghost' size='icon' className='size-12' aria-label={t('billDetails')}>
            <Link to='/ticket/$ticketId' params={{ ticketId: String(ticketId) }}>
              <Ellipsis className='size-5' />
            </Link>
          </Button>
        )}
        {(!addingToTicket || lines.length > 0) && (
          <Button
            variant='ghost'
            size='icon'
            className='size-12'
            aria-label={t('clearSale')}
            disabled={lines.length === 0 && (addingToTicket || (!customer && !note && !delivery))}
            onClick={() => {
              // On a bill only what was not sent yet goes: who it is for stays
              const who = addingToTicket ? customer : null
              clear()
              if (who) setCustomer(who)
            }}
          >
            <Trash2 className='size-5' />
          </Button>
        )}
      </div>

      <div className='border-b px-3 py-2 empty:hidden'>
        {/* The room's clock, one line: always in sight, the rest a tap away */}
        {bill.runningStay && (
          <div className='mb-2'>
            <StayStrip stay={bill.runningStay} />
          </div>
        )}
        {/* What kind of order: decided first, and always in sight */}
        {saleDelivery.canOffer && (
          <div className='mb-2'>
            <OrderTypeSwitch
              delivering={!!delivery}
              onDelivery={() => saleDelivery.setFormOpen(true)}
              onCounter={saleDelivery.remove}
            />
          </div>
        )}
        {/* Who it is for: one box, as on a new sale. On a bill the people
            already on it sit under the box, a tap each, so the next round
            changes hands without a search */}
        <div className='flex items-center gap-2 empty:hidden'>
          {customer ? (
            <div className='min-w-0 flex-1'>
              <SelectedCustomer
                customer={customer}
                onRemove={() => setCustomer(null)}
              />
            </div>
          ) : (
            <div className='min-w-0 flex-1'>
              <ChooseCustomerButton onClick={() => setCustomerOpen(true)} showOptional={!addingToTicket} />
            </div>
          )}
        </div>
        {addingToTicket && otherPeople.length > 0 && (
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <span className='text-muted-foreground text-xs font-medium'>{t('alsoOnBill')}</span>
            {otherPeople.map((p) => (
              <button
                key={p.id ?? `name:${p.name}`}
                type='button'
                onClick={() => pickCustomer(p)}
                className='bg-background hover:bg-muted flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-medium'
              >
                <UserRound className='size-4 shrink-0 opacity-60' />
                <bdi className='truncate'>{p.name || t('guest')}</bdi>
              </button>
            ))}
          </div>
        )}
        {delivery && (
          <div className='mt-2'>
            <SaleDeliverySummary
              delivery={delivery}
              readiness={saleDelivery.readiness}
              onEdit={() => saleDelivery.setFormOpen(true)}
              onRemove={saleDelivery.remove}
              onRetry={saleDelivery.retry}
            />
          </div>
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {/* What is on the bill already, quieter than what is being rung up now */}
        {addingToTicket && (billLines.length > 0 || bill.mySends.length > 0) && (
          <div className='pb-1'>
            <SectionLabel>{t('onTheBill')}</SectionLabel>
            <div className='flex flex-col divide-y opacity-80'>
              {mergeIdenticalLines(billLines).map((line) => (
                <LineRow
                  key={String(line.id)}
                  line={line}
                  selecting={false}
                  selected={false}
                  onToggle={() => {}}
                  landed={bill.landed.includes(toNumber(line.orderId))}
                />
              ))}
            </div>
            <SendingLines sends={bill.mySends} />
          </div>
        )}
        {addingToTicket && lines.length > 0 && <SectionLabel accent>{t('newItems')}</SectionLabel>}
        {lines.length === 0 ? null : (
          <div className='flex flex-col divide-y'>
            {lines.map((line) => (
              <div
                key={lineKey(line)}
                ref={(el) => {
                  if (el) rowRefs.current.set(lineKey(line), el)
                  else rowRefs.current.delete(lineKey(line))
                }}
              >
                {/* Just rung up: a soft tint behind it fades out, keyed by
                    the tap so each one starts it again */}
                <div
                  key={rungUp[lineKey(line)] ?? 0}
                  className={cn(rungUp[lineKey(line)] && 'animate-landed')}
                >
                  <CartLineRow line={line} onSetQuantity={setQuantity} />
                </div>
              </div>
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
        {/* What the whole bill comes to, with what is being rung up now */}
        {addingToTicket && billTotal != null && (
          <div className='flex items-baseline justify-between'>
            <span className='text-muted-foreground text-sm'>{t('total')}</span>
            <span className='text-2xl font-bold tabular-nums'>{money(billTotal)}</span>
          </div>
        )}
        {(!addingToTicket || lines.length > 0) && (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('orderNoteOptional')}
            className='h-12 text-base'
            autoComplete='off'
          />
        )}
        {addingToTicket && lines.length === 0 ? (
          // Nothing new to send: the bill's next step is its payment (its
          // page takes it, with its guards: a running clock, orders waiting)
          <Button
            size='lg'
            className='h-14 w-full text-lg'
            disabled={billLines.length === 0 || bill.mySends.length > 0}
            onClick={() =>
              navigate({
                to: '/ticket/$ticketId',
                params: { ticketId: String(ticketId) },
                search: { settle: true },
              })
            }
          >
            {bill.onTheirWay.length > 0 ? (
              <>
                <Loader2 className='size-5 animate-spin' />
                {t('confirming')}
              </>
            ) : (
              t('settleAction')
            )}
          </Button>
        ) : (
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
                ? t('sendNewItems', { count })
                : delivering
                  ? t('deliverySend')
                  : t('chargeAction')}
            </span>
            <span className='tabular-nums'>{money(total)}</span>
          </Button>
        )}
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
            {/* The bill is this screen now, so Back is always the floor */}
            <Link to='/' aria-label={t('backToFloor')}>
              <BackIcon className='size-6' />
            </Link>
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
      {(placeOrder.isPending || priceCheck.checking || addingCaller) && (
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
