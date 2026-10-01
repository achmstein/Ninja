import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Timer } from 'lucide-react'
import { type BillLineView, type BillView } from '@/api/sales'
import {
  closedAt,
  hoursLabel,
  isSettled,
  percent,
  runningTime,
  useNow,
  type RunningTime,
} from '@/lib/bills'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { springSoft } from '@/lib/motion'
import { useActiveStay } from '@/lib/stays'
import { cn } from '@/lib/utils'
import { ReceiptBrand } from './receipt-brand'

const tenderKey: Record<string, TranslationKey> = {
  Cash: 'cash',
  Card: 'card',
  InstaPay: 'instapay',
  Account: 'onYourTab',
  Mixed: 'paidSeveralWays',
}

/**
 * The paper the till prints, on screen: black on white whatever the theme,
 * 72mm wide, its foot torn the way a slip comes off the roll. It rises into
 * place like a page's blocks, and what is printed on it settles a beat
 * later, as if it were still coming out of the printer.
 */
export function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      data-paper
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      // The shadow follows the torn edge, which a box-shadow would not (a card it prints out in keeps it tight, through data-paper)
      className={cn('mx-auto w-full max-w-[300px] drop-shadow-[0_10px_24px_rgb(0_0_0/0.14)]', className)}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springSoft, delay: 0.08 }}
        className='flex flex-col gap-2 rounded-t-[1.25rem] bg-white px-4 pt-5 pb-3 text-[12px] leading-snug text-black'
      >
        {children}
      </motion.div>
      <div aria-hidden className='h-2 bg-[radial-gradient(circle_at_7px_0,white_6px,transparent_6.5px)] bg-[length:14px_8px] bg-repeat-x' />
    </motion.div>
  )
}

/**
 * The bill as the slip the till would print: every line on the ticket
 * with the name the till put on it, the room's time, the discount,
 * service and VAT, the total, and how it was paid, on the Paper. The
 * customer is on this bill, so nobody on it is hidden from them.
 */
export function BillSlip({ bill }: { bill: BillView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const stay = useActiveStay()
  const now = useNow()

  const lines = bill.lines ?? []
  const running = runningTime(bill, stay, now)
  const subtotal = Number(bill.subtotal ?? 0)
  const discount = Number(bill.discount ?? 0)
  const service = Number(bill.serviceCharge ?? 0)
  const vat = Number(bill.vat ?? 0)
  const total = Number(bill.total ?? 0) + (running?.charged ?? 0)
  const refunded = Number(bill.refundedTotal ?? 0)
  const hasBreakdown = discount > 0 || service > 0 || vat > 0
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const closed = closedAt(bill)

  const row = 'flex items-baseline justify-between gap-2 tabular-nums'
  // The dashed rule a thermal printer draws between the slip's parts
  const rule = <div className='border-t border-dashed border-black' />

  return (
    <Paper>
      <div className='flex flex-col items-center text-center'>
        <ReceiptBrand />
        <div className='text-[13px] font-semibold'>
          {bill.receiptNumber != null
            ? t('receiptNumber', { number: Number(bill.receiptNumber) })
            : localized(bill.locationName) || t('atTheCounter')}
        </div>
        {bill.receiptNumber != null && localized(bill.locationName) && (
          <div className='text-[11px]'>{localized(bill.locationName)}</div>
        )}
        {bill.openedAt && (
          <div className='text-[11px] tabular-nums'>
            {new Date(bill.openedAt).toLocaleString(locale, {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
            {closed &&
              ` – ${closed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        )}
        {bill.status === 'Voided' && (
          <div className='text-[11px] font-semibold'>{t('voided')}</div>
        )}
      </div>

      {rule}

      <div className='flex flex-col gap-1.5'>
        {lines.map((line) => (
          <SlipLine key={String(line.id)} line={line} />
        ))}
        {running && <RunningTimeLine bill={bill} running={running} slip />}
      </div>

      {rule}

      {hasBreakdown && (
        <div className='flex flex-col gap-0.5 text-[11px]'>
          <div className={row}>
            <span>{t('subtotal')}</span>
            <span>{price(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className={row}>
              <span>
                {t('discount')}
                {bill.discountRate != null && ` ${percent(bill.discountRate)}%`}
              </span>
              <span>−{price(discount)}</span>
            </div>
          )}
          {service > 0 && (
            <div className={row}>
              <span>
                {t('serviceCharge', {
                  rate: String(percent(bill.serviceChargeRate)),
                })}
              </span>
              <span>{price(service)}</span>
            </div>
          )}
          {vat > 0 && !bill.vatIncluded && (
            <div className={row}>
              <span>{t('vat', { rate: String(percent(bill.vatRate)) })}</span>
              <span>{price(vat)}</span>
            </div>
          )}
        </div>
      )}

      <div className={`${row} text-[15px] font-bold`}>
        <span>{t('total')}</span>
        <span>
          {running && '≈ '}
          {price(total)}
        </span>
      </div>
      {vat > 0 && bill.vatIncluded && (
        <div className={`${row} -mt-1 text-[10px]`}>
          <span>
            {t('vatIncluded', { rate: String(percent(bill.vatRate)) })}
          </span>
          <span>{price(vat)}</span>
        </div>
      )}

      {isSettled(bill) && bill.paidWith && (
        <div className={row}>
          <span>
            {tenderKey[bill.paidWith]
              ? t(tenderKey[bill.paidWith])
              : bill.paidWith}
          </span>
          <span>{price(Number(bill.total ?? 0))}</span>
        </div>
      )}
      {refunded > 0 && (
        <div className={`${row} font-medium`}>
          <span>{t('refunded')}</span>
          <span>−{price(refunded)}</span>
        </div>
      )}
    </Paper>
  )
}

/** A line as the till prints it: the description and its total, then
 *  quantity × price, any discount, and the name the till put on it. */
function SlipLine({ line }: { line: BillLineView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const isTime = line.source === 'SessionTime'
  const qty = Number(line.qty ?? 0)
  const discount = Number(line.discount ?? 0)

  return (
    <div>
      <div className='flex items-baseline justify-between gap-2'>
        <span>{localized(line.description)}</span>
        <span className='shrink-0 tabular-nums'>
          {price(Number(line.total ?? 0))}
        </span>
      </div>
      <div className='text-[10px] tabular-nums'>
        {isTime ? t('hoursShort', { count: hoursLabel(qty) }) : qty} ×{' '}
        {price(Number(line.unitPrice ?? 0))}
        {isTime && t('perHourShort')}
        {discount > 0 && ` − ${price(discount)} (${t('discount')})`}
        {line.customerName && ` · ${line.customerName}`}
      </div>
      {localized(line.details) && (
        <div className='text-[10px]'>{localized(line.details)}</div>
      )}
    </div>
  )
}

/** The clock still running: its time so far, as the till will bill it. */
export function RunningTimeLine({
  bill,
  running,
  slip = false,
}: {
  bill: BillView
  running: RunningTime
  /** On the slip: no icon, the smaller type */
  slip?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const place = localized(bill.locationName)
  const hours = Math.floor(running.minutes / 60)
  const minutes = Math.floor(running.minutes % 60)
  const elapsed = `${hours}:${String(minutes).padStart(2, '0')}`
  const perOption = running.parts.length > 1

  return (
    <div>
      {running.parts.map((part, i) => (
        <div key={i}>
          <div
            className={cn(
              'flex items-baseline gap-1',
              slip ? 'justify-between gap-2' : 'text-sm',
            )}
          >
            {!slip && (
              <Timer className='text-muted-foreground h-3.5 w-3.5 shrink-0 self-center' />
            )}
            <span className='min-w-0 flex-1'>
              {t('timeSoFar', { place })}
              {perOption && ` — ${localized(part.optionName)}`}
            </span>
            <span className='shrink-0 tabular-nums'>≈ {price(part.cost)}</span>
          </div>
          <p
            className={cn(
              'tabular-nums',
              slip ? 'text-[10px]' : 'text-muted-foreground ms-6 text-xs',
            )}
          >
            {i === 0 && `${elapsed} · `}
            {t('hoursShort', { count: hoursLabel(part.hours) })} ×{' '}
            {price(part.rate)}
            {t('perHourShort')}
          </p>
        </div>
      ))}
    </div>
  )
}
