import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Coffee,
  Loader2,
  Minus,
  Plus,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { listCategoriesOptions, listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { createPosOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { getTicketByOrderOptions } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { lineKey, saleCount, saleTotal, useSale, type SaleLine } from './cart'
import { CustomerDialog } from './customer-dialog'
import { CustomizeDialog } from './customize-dialog'
import { itemPictureUrl } from './item-picture'

// The counter ticket materializes off the order-confirmed event, so the
// order → ticket lookup 404s for a moment. Poll fast (a cashier is standing
// there); the SignalR TicketUpdated invalidation short-circuits the wait.
const TICKET_POLL_INTERVAL_MS = 600
const TICKET_POLL_TIMEOUT_MS = 12_000

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
        {item.pictureUri ? (
          <img
            src={itemPictureUrl(item.id)}
            alt=''
            loading='lazy'
            className='h-full w-full object-cover'
          />
        ) : (
          <Coffee className='text-muted-foreground/40 size-8' />
        )}
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
      language === 'ar' && c.optionNameAr ? c.optionNameAr : c.optionNameEn
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
 */
export function SalePad() {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { lines, note, customer, add, setQuantity, setNote, setCustomer, clear } =
    useSale()

  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  // Set once the order is accepted; drives the blocking "sending to
  // kitchen" state while the ticket lookup polls
  const [pending, setPending] = useState<{
    orderId: number
    startedAt: number
  } | null>(null)

  const { data: categories = [] } = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )
  const { data: items = [], isLoading: itemsLoading } = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const sortedCategories = categories
    .slice()
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const activeCategoryId =
    activeCategory ??
    (sortedCategories.length > 0 ? toNumber(sortedCategories[0].id) : null)
  const visibleItems = items
    .filter((item) => toNumber(item.catalogTypeId) === activeCategoryId)
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))

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

  const placeOrder = useMutation({
    ...createPosOrderMutation(),
    onSuccess: (data) => {
      // The order landed — the next charge is a new logical request
      requestIdRef.current = null
      const orderId = toNumber(data.orderId)
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
      // retry of the previous one
      customer: customer?.id ?? null,
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
        // No tableId/roomName: a counter sale settles at the till
        customerUserId: customer?.id ?? null,
        customerUserName: customer?.name ?? null,
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
    const handle = setTimeout(() => {
      setPending(null)
      clear()
      toast.warning(t('ticketNotReadyYet'))
      navigate({ to: '/' })
    }, Math.max(0, remaining))
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  return (
    <div className='flex h-[calc(100svh-4rem)]'>
      {/* ----- item pad ----- */}
      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='flex items-center gap-2 border-b p-2'>
          <Button asChild variant='ghost' size='icon' className='size-12 shrink-0'>
            <Link to='/' aria-label={t('backToFloor')}>
              <BackIcon className='size-6' />
            </Link>
          </Button>
          <div className='flex gap-2 overflow-x-auto'>
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
                <Skeleton key={i} className='aspect-[4/5] rounded-xl' />
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
          <h2 className='min-w-0 flex-1 truncate text-lg font-bold'>
            {t('currentSale')}
            {count > 0 && (
              <span className='text-muted-foreground ms-2 text-sm font-medium'>
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
          {customer ? (
            <div className='bg-accent/50 flex items-center justify-between gap-1 rounded-lg py-1 ps-3'>
              <span className='flex min-w-0 items-center gap-2'>
                <User className='size-4 shrink-0' />
                <span className='truncate font-medium'>{customer.name}</span>
              </span>
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
          ) : (
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
          {lines.length === 0 ? (
            <p className='text-muted-foreground px-6 py-16 text-center text-sm'>
              {t('emptySale')}
            </p>
          ) : (
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
            <span>{t('chargeAction')}</span>
            <span className='tabular-nums'>{money(total)}</span>
          </Button>
        </div>
      </aside>

      <CustomizeDialog
        item={customizeItem}
        onOpenChange={(open) => !open && setCustomizeItem(null)}
        onAdd={(line) => {
          add(line)
          setCustomizeItem(null)
        }}
      />
      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onSelect={setCustomer}
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
