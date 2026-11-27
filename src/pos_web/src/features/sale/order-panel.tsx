import { useState, type ElementType, type ReactNode, type RefObject } from 'react'
import { ChevronRight, Loader2, Plus, Trash2, UserPlus } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectedCustomer } from '@/features/customer/selected-customer'
import { StayStrip } from '@/features/places/stay-strip'
import { SendingLines } from '@/features/sending/sending-lines'
import { DiscountDialog } from '@/features/ticket/discount-dialog'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { BillMenu } from './bill-menu'
import { lineKey, type SaleCustomer, type SaleLine } from './cart'
import { NewLineRow, SectionLabel, SentLines, type LineSelection } from './order-lines'
import { OrderTypeSwitch } from './order-type-switch'
import { SaleDeliverySummary } from './sale-delivery-summary'
import type { useOpenBill } from './use-open-bill'
import type { useSaleDelivery } from './use-sale-delivery'

/** The order's one big button: what it says, what it comes to, and whether it can be pressed */
export type PrimaryAction = {
  label: string
  /** Shown at the button's end; left out, the words are centred */
  amount?: number
  disabled: boolean
  busy?: boolean
  onClick: () => void
}

/**
 * The order side of the sale screen: one plain list, as a receipt reads.
 *
 * Its head says what it is (a new sale, or the table, room or tab it is rung
 * onto) and carries what goes with that: the room's clock, the counter or
 * delivery switch, the sale's customer, the delivery's address. Its list is
 * what is new, then what was sent; nobody is asked for a name while items are
 * rung up. Its foot is the total and one button: Send what is new, or take
 * the money.
 */
export function OrderPanel({
  Heading,
  title,
  ticketId,
  bill,
  customer,
  onFindCustomer,
  onRemoveCustomer,
  saleDelivery,
  lines,
  count,
  rungUp,
  rowRefs,
  onSetQuantity,
  suggestions,
  onSuggestion,
  note,
  onNote,
  total,
  partPaid,
  deliveryFee,
  primary,
  onClear,
  selection,
  onSelectLines,
  footer,
}: {
  /** `h2` beside the menu; the sheet's own title on a phone */
  Heading: ElementType
  title: string
  ticketId: number | undefined
  bill: ReturnType<typeof useOpenBill>
  /** A new sale's customer: one for the whole sale, and optional */
  customer: SaleCustomer | null
  onFindCustomer: () => void
  onRemoveCustomer: () => void
  saleDelivery: ReturnType<typeof useSaleDelivery>
  lines: SaleLine[]
  count: number
  /** How many times each line was rung up here, so its tint starts again on every tap */
  rungUp: Record<string, number>
  rowRefs: RefObject<Map<string, HTMLDivElement>>
  onSetQuantity: (key: string, quantity: number) => void
  suggestions: CatalogItemDto[]
  onSuggestion: (item: CatalogItemDto) => void
  note: string
  onNote: (note: string) => void
  /** What the order comes to: the whole bill with what is new, or the new sale */
  total: number
  /** Taken already in part payments, on a bill still open */
  partPaid: number
  deliveryFee: number
  primary: PrimaryAction
  onClear: () => void
  /** Sent lines are being picked (to split off, move or name) */
  selection?: LineSelection
  onSelectLines: () => void
  /** What stands in the button's place while lines are picked */
  footer?: ReactNode
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const onBill = ticketId !== undefined
  const { delivery, delivering } = saleDelivery
  const sent = bill.ticket?.lines ?? []
  const hasSent = sent.length > 0 || bill.mySends.length > 0
  // Money off the bill is said over its total, where it is taken off: never only inside a menu
  const discount = toNumber(bill.ticket?.discount)
  const discountRate = bill.ticket?.discountRate != null ? Math.round(toNumber(bill.ticket.discountRate) * 10000) / 100 : null
  const [discountOpen, setDiscountOpen] = useState(false)

  return (
    <>
      {/* Built like the item pad's search row (py-2, a size-12 button), so the two rules under them meet in one line */}
      <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2 max-md:pe-14'>
        <Heading className='flex min-w-0 flex-1 items-baseline type-title gap-2'>
          <span className='truncate'>{title}</span>
          {onBill ? (
            <span className='text-muted-foreground type-detail shrink-0 font-medium tabular-nums' dir='ltr'>
              #{ticketId}
            </span>
          ) : (
            count > 0 && <span className='text-muted-foreground type-detail shrink-0 font-medium'>{t('linesCount', { count })}</span>
          )}
        </Heading>
        {/* The rest a bill can do (discount, print, void) opens here, over the order */}
        {onBill && bill.ticket && !bill.closed && (
          <BillMenu
            ticket={bill.ticket}
            runningStay={bill.runningStay}
            sending={bill.mySends.length > 0}
            onSelectLines={onSelectLines}
          />
        )}
        {(!onBill || lines.length > 0) && (
          <Button
            variant='ghost'
            size='icon'
            className='size-12'
            aria-label={t('clearSale')}
            disabled={lines.length === 0 && (onBill || (!customer && !note && !delivery))}
            onClick={onClear}
          >
            <Trash2 className='size-5' />
          </Button>
        )}
      </div>

      <div className='flex flex-col gap-2 border-b px-3 py-2 empty:hidden'>
        {/* The room's clock, one line: always in sight, the rest a tap away */}
        {bill.runningStay && <StayStrip stay={bill.runningStay} />}
        {/* What kind of order: decided first, and always in sight */}
        {saleDelivery.canOffer && (
          <OrderTypeSwitch
            delivering={!!delivery}
            onDelivery={() => saleDelivery.setFormOpen(true)}
            onCounter={saleDelivery.remove}
          />
        )}
        {/* A new sale is one customer's whole, and optional: always in this one place. A bill asks at Send */}
        {!onBill &&
          (customer ? (
            <SelectedCustomer customer={customer} onRemove={onRemoveCustomer} />
          ) : (
            <Button variant='outline' className='text-muted-foreground h-12 w-full gap-2 border-dashed text-base' onClick={onFindCustomer}>
              <UserPlus className='size-5' />
              {t('customerOptional')}
            </Button>
          ))}
        {delivery && (
          <SaleDeliverySummary
            delivery={delivery}
            readiness={saleDelivery.readiness}
            onEdit={() => saleDelivery.setFormOpen(true)}
            onRemove={saleDelivery.remove}
            onRetry={saleDelivery.retry}
          />
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {/* What is new first: it is what the hands are on */}
        {lines.length > 0 && hasSent && <SectionLabel>{t('newItems')}</SectionLabel>}
        <div className='flex flex-col divide-y'>
          {lines.map((line) => {
            const key = lineKey(line)
            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) rowRefs.current.set(key, el)
                  else rowRefs.current.delete(key)
                }}
              >
                {/* Just rung up: a soft tint behind it fades out, keyed by the tap so each one starts it again */}
                <div key={rungUp[key] ?? 0} className={cn(rungUp[key] && 'animate-landed')}>
                  <NewLineRow line={line} onSetQuantity={onSetQuantity} marked={onBill} />
                </div>
              </div>
            )
          })}
        </div>
        {hasSent && (
          <>
            {lines.length > 0 && <SectionLabel>{t('sentItems')}</SectionLabel>}
            {/* Charged a moment ago and on their way: they breathe until the server has them */}
            <SendingLines sends={bill.mySends} />
            <SentLines lines={sent} landed={bill.landed} selection={selection} />
          </>
        )}
        {onBill && !hasSent && lines.length === 0 && bill.ticket && (
          <p className='text-muted-foreground px-6 py-16 text-center'>{t('orderEmptyHint')}</p>
        )}
      </div>

      {/* What the item rung up last goes well with: one tap to offer it */}
      {suggestions.length > 0 && (
        <div className='border-t px-3 pt-2 pb-1'>
          <div className='text-muted-foreground type-caption mb-1.5 font-medium'>{t('goesWellWith')}</div>
          <div className='no-scrollbar flex gap-2 overflow-x-auto pb-1'>
            {suggestions.map((item) => (
              <Button key={String(item.id)} variant='outline' className='h-10 shrink-0 gap-1.5 px-3' onClick={() => onSuggestion(item)}>
                <Plus className='size-4' />
                {localized(item.name)}
                <span className='text-muted-foreground tabular-nums'>{money(toNumber(item.effectivePrice ?? item.price))}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3 border-t p-3'>
        {delivering && (
          <div className='text-muted-foreground type-detail flex justify-between'>
            <span>{t('deliveryFee')}</span>
            <span className='tabular-nums'>{deliveryFee > 0 ? money(deliveryFee) : t('deliveryFree')}</span>
          </div>
        )}
        {/* The discount on the bill and what it takes off, nothing else: a tap changes it or takes it away */}
        {onBill && bill.ticket && discount > 0 && (
          <button
            type='button'
            disabled={bill.closed}
            onClick={() => setDiscountOpen(true)}
            className='type-detail flex min-h-12 w-full items-center gap-2 rounded-lg bg-emerald-500/10 px-3 text-start text-emerald-700 dark:text-emerald-400'
          >
            <span className='min-w-0 flex-1 truncate font-medium'>
              {t('discount')}
              {discountRate != null && (
                <span className='tabular-nums' dir='ltr'>
                  {' '}
                  {discountRate}%
                </span>
              )}
            </span>
            <span className='font-semibold tabular-nums'>−{money(discount)}</span>
            {!bill.closed && <ChevronRight className='size-4 shrink-0 rtl:rotate-180' aria-hidden />}
          </button>
        )}
        {onBill && bill.ticket && <DiscountDialog ticket={bill.ticket} open={discountOpen} onOpenChange={setDiscountOpen} />}
        <div className='flex items-baseline justify-between'>
          <span className='text-muted-foreground type-detail'>{t('total')}</span>
          <span className='type-figure'>{money(total)}</span>
        </div>
        {/* Part of it is paid already: what was taken, and what is left to take */}
        {partPaid > 0 && (
          <div className='type-detail -mt-2 flex items-baseline justify-between'>
            <span className='font-medium text-emerald-700 dark:text-emerald-400'>{t('partPaidSoFar', { amount: money(partPaid) })}</span>
            <span className='font-semibold tabular-nums'>{t('leftToPay', { amount: money(Math.max(0, total - partPaid)) })}</span>
          </div>
        )}
        {lines.length > 0 && (
          <Input
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={t('orderNoteOptional')}
            className='h-12 text-base'
            autoComplete='off'
          />
        )}
        {footer ?? (
        <Button
          size='lg'
          className={cn('h-14 w-full px-5 text-lg', primary.amount != null && 'justify-between')}
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          <span className='flex items-center gap-2'>
            {primary.busy && <Loader2 className='size-5 animate-spin' />}
            {primary.label}
          </span>
          {primary.amount != null && <span className='tabular-nums'>{money(primary.amount)}</span>}
        </Button>
        )}
      </div>
    </>
  )
}
