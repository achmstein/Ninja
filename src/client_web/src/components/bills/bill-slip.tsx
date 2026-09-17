import { Timer } from 'lucide-react'
import { type BillLineView, type BillView } from '@/api/sales'
import {
  closedAt,
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
import { useActiveStay } from '@/lib/stays'
import { cn } from '@/lib/utils'

const tenderKey: Record<string, TranslationKey> = {
  Cash: 'cash',
  Card: 'card',
  InstaPay: 'instapay',
  Account: 'onYourTab',
  Mixed: 'paidSeveralWays',
}

/**
 * The bill as the slip the till would print: every line on the ticket
 * with the name the till put on it, the room's time, the discount,
 * service and VAT, the total, and how it was paid. Black on white
 * whatever the theme, 72mm wide. The customer is on this bill, so nobody
 * on it is hidden from them.
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
    <div className='mx-auto flex w-full max-w-[300px] flex-col gap-2 bg-white px-4 py-5 text-[12px] leading-snug text-black shadow-sm'>
      <div className='flex flex-col items-center text-center'>
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
    </div>
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
        {isTime ? t('hoursShort', { count: String(qty) }) : qty} ×{' '}
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
            {t('hoursShort', { count: String(part.hours) })} ×{' '}
            {price(part.rate)}
            {t('perHourShort')}
          </p>
        </div>
      ))}
    </div>
  )
}
