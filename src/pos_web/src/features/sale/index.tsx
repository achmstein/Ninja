import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import {
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { createPosOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import {
  getTicketByOrderOptions,
  getTicketOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import { useLoyalty } from '@/features/customer/use-customer-card'
import { stayRoster } from '@/features/places/status'
import { useStay, useStayActions } from '@/features/places/use-places'
import { API_VERSION, apiClient } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import {
  lineKey,
  saleCount,
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

// The counter ticket materializes off the order-confirmed event, so the
// order → ticket lookup 404s for a moment. Poll fast (a cashier is standing
// there); the SignalR TicketUpdated invalidation short-circuits the wait.
const TICKET_POLL_INTERVAL_MS = 600
const TICKET_POLL_TIMEOUT_MS = 12_000
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
      <div className='bg-muted flex aspect-square w-full items-center justify-center overflow-hidden'>
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
  const name = language === 'ar' && line.nameAr ? line.nameAr : line.nameEn
  const optionsLabel = line.customizations
    .map((c) =>
      language === 'ar' && c.optionNameAr ? c.optionNameAr : c.optionNameEn,
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
/**
 * The attached customer's points under their name — information only:
 * points are earned and spent in the customer app, the till never touches
 * them. Quiet when they never joined.
 */
function CustomerPointsLine({ userId }: { userId: string }) {
  const t = useT()
  const { account, notEnrolled } = useLoyalty(userId)
  if (!account && !notEnrolled) return null
  return (
    <span className='text-muted-foreground block truncate text-xs tabular-nums'>
      {notEnrolled
        ? t('notEnrolled')
        : t('pointsBalance', { points: toNumber(account?.pointsBalance) })}
    </span>
  )
}

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
  const features = useFeatures()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  // Before paint, so the cashier never sees the previous destination's cart
  useLayoutEffect(() => {
    setTarget(ticketId ?? null)
  }, [ticketId, setTarget])

  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(
    null,
  )
  const [customerOpen, setCustomerOpen] = useState(false)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)

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

  // Set once the order is accepted; drives the blocking "sending to
  // kitchen" state while the ticket lookup polls
  const [pending, setPending] = useState<{
    orderId: number
    startedAt: number
  } | null>(null)

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
  const visibleItems =
    activeCategoryId === USUALS_CATEGORY
      ? usualItems
      : items
          .filter((item) => toNumber(item.catalogTypeId) === activeCategoryId)
          .sort(
            (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0),
          )

  const total = saleTotal(lines)
  const count = saleCount(lines)

  const tapItem = (item: CatalogItemDto) => {
    if (item.customizations?.length) {
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
    })
  }

  // Idempotency mirror of client_web/cart: the request id must survive
  // retries of the SAME sale, so a resubmit after a timeout (where the
  // server actually processed the first attempt) is deduplicated instead of
  // ringing the customer up twice. A new id is only issued when the sale
  // content changes.
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)

  // After a POS order for an attached customer, remember how their items were
  // customized so it prefills next time — the same thing the customer app does
  // for its own orders. Fire-and-forget; a failure just means no prefill.
  const saveCustomerPreferences = (
    customerId: string,
    saleLines: SaleLine[],
  ) => {
    const byProduct = new Map<
      number,
      { customizationId: number; optionId: number }[]
    >()
    for (const line of saleLines) {
      if (!line.customizations?.length) continue
      // Last line for a product wins, matching the app's last-order-wins rule
      byProduct.set(
        line.productId,
        line.customizations.map((c) => ({
          customizationId: c.customizationId,
          optionId: c.optionId,
        })),
      )
    }
    if (byProduct.size === 0) return
    const items = [...byProduct.entries()].map(
      ([catalogItemId, selectedOptions]) => ({
        catalogItemId,
        selectedOptions,
      }),
    )
    apiClient
      .post(`/api/catalog/customers/${customerId}/preferences`, { items })
      .catch(() => {})
  }

  const placeOrder = useMutation({
    ...createPosOrderMutation(),
    onSuccess: (data) => {
      // Save the attached customer's choices before the cart is cleared below
      if (customer?.id) saveCustomerPreferences(customer.id, lines)
      // The order landed — the next charge is a new logical request
      requestIdRef.current = null
      const orderId = toNumber(data.orderId)

      // Adding to a bill already on the floor: the order names the ticket,
      // so there is no lookup to wait on and nothing to pay yet. The lines
      // land over SignalR (the ticket screen's poll is the fallback).
      if (addingToTicket) {
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        toast.success(
          t(orderId === 0 ? 'orderAlreadyPlaced' : 'itemsAddedToTicket'),
        )
        navigate({
          to: '/ticket/$ticketId',
          params: { ticketId: String(ticketId) },
        })
        return
      }

      if (orderId === 0) {
        // Deduplicated retry: the first attempt went through and its ticket
        // is (or will be) on the floor — don't wait on a lookup for an order
        // id we don't have
        clear()
        toast.info(t('orderAlreadyPlaced'))
        navigate({ to: '/' })
        return
      }
      setPending({ orderId, startedAt: Date.now() })
    },
  })

  const charge = () => {
    const signature = JSON.stringify({
      lines: lines.map((line) => [
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
    })
    if (!requestIdRef.current || requestIdRef.current.signature !== signature) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }

    placeOrder.mutate({
      body: {
        // Same BasketItem mapping as client_web's checkout
        items: lines.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.productId,
          productName: { en: line.nameEn, ar: line.nameAr || null },
          unitPrice: line.price,
          quantity: line.quantity,
          pictureUrl: line.pictureUrl ?? null,
          specialInstructions: line.specialInstructions ?? null,
          selectedCustomizations: line.customizations.map((c) => ({
            customizationId: c.customizationId,
            customizationName: {
              en: c.customizationNameEn,
              ar: c.customizationNameAr ?? null,
            },
            optionId: c.optionId,
            optionName: { en: c.optionNameEn, ar: c.optionNameAr ?? null },
            priceAdjustment: c.priceAdjustment,
          })),
        })),
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
      },
      headers: { 'x-requestid': requestIdRef.current.id },
      query: { 'api-version': API_VERSION },
    })
  }

  // The order → ticket lookup 404s until Sales consumes the confirmation
  // event; keep polling (retry:false makes each 404 land fast so the
  // interval refires) until it resolves or the timeout gives up
  const ticketLookup = useQuery({
    ...getTicketByOrderOptions({
      path: { orderId: pending?.orderId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: pending !== null,
    retry: false,
    refetchInterval: TICKET_POLL_INTERVAL_MS,
    staleTime: 0,
    gcTime: 0,
  })

  const foundTicketId = ticketLookup.data
    ? toNumber(ticketLookup.data.ticketId)
    : null

  useEffect(() => {
    if (pending === null || foundTicketId === null) return
    setPending(null)
    clear()
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
    navigate({
      to: '/ticket/$ticketId',
      params: { ticketId: String(foundTicketId) },
      search: { settle: true },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, foundTicketId])

  // Give up after ~12s of 404s: the order IS in the kitchen (clearing the
  // cart prevents a duplicate charge), the ticket just hasn't landed yet —
  // it will show up on the floor via SignalR. A plain timer, so the wait
  // can never hang on the polling machinery; success above clears it.
  useEffect(() => {
    if (pending === null) return
    const remaining = TICKET_POLL_TIMEOUT_MS - (Date.now() - pending.startedAt)
    const handle = setTimeout(
      () => {
        setPending(null)
        clear()
        toast.warning(t('ticketNotReadyYet'))
        navigate({ to: '/' })
      },
      Math.max(0, remaining),
    )
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

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
          {/* Every category in view: the chips wrap into rows rather than
              scrolling sideways behind a scrollbar */}
          <div className='flex min-w-0 flex-1 flex-wrap gap-2'>
            {hasUsuals && (
              <Button
                variant={
                  activeCategoryId === USUALS_CATEGORY ? 'default' : 'outline'
                }
                className='h-11 shrink-0 px-4 text-base'
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
                  className='h-11 shrink-0 px-4 text-base'
                  onClick={() => setActiveCategory(id)}
                >
                  {localized(category.name)}
                </Button>
              )
            })}
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-3'>
          {itemsLoading ? (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3'>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className='flex flex-col overflow-hidden rounded-xl border shadow-xs'
                >
                  {/* Square picture, then name and price lines — the item tile's shape */}
                  <Skeleton className='aspect-square w-full rounded-none' />
                  <div className='flex flex-col gap-1.5 p-2'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <p className='text-muted-foreground py-16 text-center'>
              {t('noItemsInCategory')}
            </p>
          ) : (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3'>
              {visibleItems.map((item) => (
                <ItemTile key={String(item.id)} item={item} onTap={tapItem} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ----- running sale ----- */}
      <aside className='flex w-[340px] shrink-0 flex-col border-s xl:w-[380px]'>
        <div className='flex items-center gap-2 border-b p-3'>
          <h2 className='flex min-w-0 flex-1 items-baseline gap-2 text-lg font-bold'>
            <span className='truncate'>{t('currentSale')}</span>
            {count > 0 && (
              <span className='text-muted-foreground shrink-0 text-sm font-medium'>
                {t('linesCount', { count })}
              </span>
            )}
          </h2>
          <Button
            variant='ghost'
            size='icon'
            className='size-11'
            aria-label={t('clearSale')}
            disabled={lines.length === 0 && !customer && !note}
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
                      'rounded-full border px-3 py-1.5 text-sm',
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
                  className='text-muted-foreground flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm'
                >
                  <UserPlus className='size-4' />
                  {t('someoneElse')}
                </button>
              </div>
            </div>
          )}
          {customer ? (
            <div className='bg-accent/50 flex items-center justify-between gap-1 rounded-lg py-1 ps-3'>
              {customer.id ? (
                /* An account: tap for the card — points and tab at a glance */
                <button
                  type='button'
                  className='flex min-w-0 flex-1 items-center gap-2 text-start'
                  onClick={() =>
                    setCardFor({
                      id: customer.id!,
                      name: customer.name,
                      phone: customer.phone,
                    })
                  }
                >
                  <User className='size-4 shrink-0' />
                  <span className='min-w-0'>
                    <span className='block truncate font-medium'>
                      {customer.name}
                    </span>
                    {features.loyalty && (
                      <CustomerPointsLine userId={customer.id} />
                    )}
                  </span>
                </button>
              ) : (
                <span className='flex min-w-0 items-center gap-2'>
                  <User className='size-4 shrink-0' />
                  <span className='truncate font-medium'>{customer.name}</span>
                </span>
              )}
              <Button
                variant='ghost'
                size='icon'
                className='size-10 shrink-0'
                aria-label={t('removeCustomer')}
                onClick={() => setCustomer(null)}
              >
                <X className='size-4' />
              </Button>
            </div>
          ) : addingToTicket && roomSession && roster.length >= 2 ? null : (
            <Button
              variant='outline'
              className='h-12 w-full gap-2 text-base'
              onClick={() => setCustomerOpen(true)}
            >
              <UserPlus className='size-5' />
              {t('chooseCustomer')}
              <span className='text-muted-foreground font-normal'>
                ({t('optional')})
              </span>
            </Button>
          )}
        </div>

        <div className='flex-1 overflow-y-auto'>
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

        <div className='flex flex-col gap-3 border-t p-3'>
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
              lines.length === 0 || placeOrder.isPending || pending !== null
            }
            onClick={charge}
          >
            <span>{addingToTicket ? t('addToTicket') : t('chargeAction')}</span>
            <span className='tabular-nums'>{money(total)}</span>
          </Button>
        </div>
      </aside>

      <CustomizeDialog
        item={customizeItem}
        customerId={customer?.id ?? null}
        onOpenChange={(open) => !open && setCustomizeItem(null)}
        onAdd={(line) => {
          add(line)
          setCustomizeItem(null)
        }}
      />
      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onSelect={pickCustomer}
        quickPicks={roster}
      />
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />

      {/* Blocking wait: the sale is committed, nothing else may be touched
          until the ticket lands (or the lookup gives up) */}
      {(pending !== null || placeOrder.isPending) && (
        <div className='bg-background/80 fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur-sm'>
          <Loader2 className='size-10 animate-spin' />
          <p className='text-lg font-semibold'>{t('sendingToKitchen')}</p>
        </div>
      )}
    </div>
  )
}
