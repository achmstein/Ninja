import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { getTicketReceiptOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { ReceiptView } from '@/api/sales'
import { API_VERSION } from '@/lib/api-client'
import { isSettled, useMyBills } from '@/lib/bills'
import { useBranches } from '@/lib/branch'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { BackHeader } from '@/components/back-header'
import { BillSlip } from '@/components/bills/bill-slip'
import { RequireAuth } from '@/components/require-auth'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuestStore } from '@/stores/guest-store'
import { useBrand, useBrandName } from '@/lib/brand'

export const Route = createFileRoute('/receipts/$ticketId')({
  component: ReceiptRoute,
})

/** Open to a guest with a guest id, like the bills page: their bills are
 *  theirs to see. Anyone else is asked to sign in. */
function ReceiptRoute() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)
  if (!auth.isAuthenticated && guestId) return <ReceiptPage />
  return (
    <RequireAuth>
      <ReceiptPage />
    </RequireAuth>
  )
}

const tenderKey: Record<string, TranslationKey> = {
  Cash: 'cash',
  Card: 'card',
  InstaPay: 'instapay',
  Account: 'onYourTab',
}

const percent = (rate: number | string | null | undefined) =>
  Math.round(Number(rate ?? 0) * 100)

/**
 * The bill, on its own page. Paid and for an account, it is the customer's
 * copy of the printed receipt: what the till printed, laid out the same
 * way, with the branch's header and footer. Otherwise — still open, or a
 * guest's — it is the bill as the slip the till would print, from the
 * customer's own bills. Sales says who was on it; anyone else sees the
 * not-found state.
 */
function ReceiptPage() {
  const { ticketId } = Route.useParams()
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()

  const bills = useMyBills()
  const bill = bills.data?.find((b) => Number(b.id) === Number(ticketId))
  // The printed receipt exists once the bill is settled; a bill known to
  // be open is not asked for
  const printed = useQuery({
    ...getTicketReceiptOptions({
      path: { id: Number(ticketId) },
      query: { 'api-version': API_VERSION },
    }),
    retry: false,
    enabled: auth.isAuthenticated && (bill == null || isSettled(bill)),
  })

  const loading =
    (printed.isLoading && printed.fetchStatus !== 'idle') ||
    (bill == null && bills.isLoading)
  const title = printed.data
    ? t('receiptNumber', { number: Number(printed.data.receiptNumber) })
    : bill?.receiptNumber != null
      ? t('receiptNumber', { number: Number(bill.receiptNumber) })
      : localized(bill?.locationName) || t('receipt')

  return (
    <div className='flex flex-col gap-4 p-4'>
      <BackHeader to='/bills' title={title} />
      {loading ? (
        <Skeleton className='h-96 rounded-xl' />
      ) : printed.data ? (
        <Receipt receipt={printed.data} />
      ) : bill ? (
        <BillSlip bill={bill} />
      ) : (
        <p className='text-muted-foreground py-16 text-center'>
          {t('receiptUnavailable')}
        </p>
      )}
    </div>
  )
}

function Receipt({ receipt }: { receipt: ReceiptView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const { data: branches = [] } = useBranches()
  const branch = branches.find((b) => Number(b.id) === Number(receipt.branchId))

  const subtotal = Number(receipt.subtotal)
  const discount = Number(receipt.discount)
  const service = Number(receipt.serviceCharge)
  const vat = Number(receipt.vat)
  const total = Number(receipt.total)
  const change = Number(receipt.changeGiven)
  const refunded = Number(receipt.refundedTotal)
  const hasBreakdown = discount > 0 || service > 0 || vat > 0

  const row = 'flex items-baseline justify-between gap-2 tabular-nums'
  // The dashed rule a thermal printer draws between the receipt's parts
  const rule = <div className='border-t border-dashed border-black' />
  const footer = localized(branch?.receiptFooter)?.trim()
  const brand = useBrand()
  const brandName = useBrandName()

  return (
    // The paper the till prints, on screen: black on white whatever the
    // theme, the wordmark on top, 72mm wide
    <div className='mx-auto flex w-full max-w-[300px] flex-col gap-2 bg-white px-4 py-5 text-[12px] leading-snug text-black shadow-sm'>
      <div className='flex flex-col items-center text-center'>
        {brand?.wordmark ? (
          <img
            src={brand.wordmark.url}
            alt=''
            style={{ aspectRatio: `${brand.wordmark.width} / ${brand.wordmark.height}` }}
            className='mb-2 block h-auto w-40 max-h-16 object-contain'
          />
        ) : brand?.logoUrl ? (
          <img src={brand.logoUrl} alt='' className='mb-2 block h-auto w-24' />
        ) : (
          <div className='mb-2 text-lg font-bold tracking-tight'>{brandName}</div>
        )}
        {branch && (
          <div className='mb-1.5 text-[11px]'>
            <div className='font-semibold'>{localized(branch.name)}</div>
            {localized(branch.address) && (
              <div>{localized(branch.address)}</div>
            )}
            {branch.phone && <div dir='ltr'>{branch.phone}</div>}
            {branch.taxNumber && (
              <div>{t('taxNumber', { number: branch.taxNumber })}</div>
            )}
          </div>
        )}
        <div className='text-[13px] font-semibold'>
          {t('receiptNumber', { number: Number(receipt.receiptNumber) })}
        </div>
        <div className='text-[11px] tabular-nums'>
          {t('receiptDate')}:{' '}
          {new Date(receipt.settledAt).toLocaleString(
            language === 'ar' ? 'ar-EG' : 'en-US',
            {
              dateStyle: 'short',
              timeStyle: 'short',
            },
          )}
        </div>
        {localized(receipt.locationName) && (
          <div className='text-[11px]'>{localized(receipt.locationName)}</div>
        )}
      </div>

      {rule}

      <div className='flex flex-col gap-1.5'>
        {receipt.lines.map((line, i) => (
          <div key={i}>
            <div className={row}>
              <span>{localized(line.description)}</span>
              <span className='shrink-0'>{price(Number(line.total))}</span>
            </div>
            <div className='text-[10px] tabular-nums'>
              {Number(line.qty)} × {price(Number(line.unitPrice))}
              {Number(line.discount) > 0 &&
                ` − ${price(Number(line.discount))} (${t('discount')})`}
              {line.customerName && ` · ${line.customerName}`}
            </div>
            {localized(line.details) && (
              <div className='text-[10px]'>{localized(line.details)}</div>
            )}
          </div>
        ))}
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
                {receipt.discountRate != null &&
                  ` ${percent(receipt.discountRate)}%`}
              </span>
              <span>−{price(discount)}</span>
            </div>
          )}
          {service > 0 && (
            <div className={row}>
              <span>
                {t('serviceCharge', {
                  rate: String(percent(receipt.serviceChargeRate)),
                })}
              </span>
              <span>{price(service)}</span>
            </div>
          )}
          {vat > 0 && !receipt.vatIncluded && (
            <div className={row}>
              <span>
                {t('vat', { rate: String(percent(receipt.vatRate)) })}
              </span>
              <span>{price(vat)}</span>
            </div>
          )}
        </div>
      )}

      <div className={`${row} text-[15px] font-bold`}>
        <span>{t('total')}</span>
        <span>{price(total)}</span>
      </div>
      {vat > 0 && receipt.vatIncluded && (
        <div className={`${row} -mt-1 text-[10px]`}>
          <span>
            {t('vatIncluded', { rate: String(percent(receipt.vatRate)) })}
          </span>
          <span>{price(vat)}</span>
        </div>
      )}

      <div className='flex flex-col gap-1'>
        {receipt.payments.map((payment, i) => (
          <div key={i} className={row}>
            <span>
              {tenderKey[payment.tender]
                ? t(tenderKey[payment.tender])
                : payment.tender}
              {payment.customerName && <span> · {payment.customerName}</span>}
            </span>
            <span>{price(Number(payment.amount))}</span>
          </div>
        ))}
        {change > 0 && (
          <div className={`${row} font-medium`}>
            <span>{t('changeDue')}</span>
            <span>{price(change)}</span>
          </div>
        )}
      </div>

      {receipt.refunds.length > 0 && (
        <>
          {rule}
          <div className='flex flex-col gap-1'>
            {receipt.refunds.map((refund) => (
              <div key={refund.number}>
                <div className={row}>
                  <span>
                    {t('creditNote', { number: Number(refund.number) })}
                  </span>
                  <span>−{price(Number(refund.amount))}</span>
                </div>
                {refund.reason && (
                  <div className='text-[10px]'>{refund.reason}</div>
                )}
              </div>
            ))}
            <div className={`${row} font-medium`}>
              <span>{t('refunded')}</span>
              <span>−{price(refunded)}</span>
            </div>
          </div>
        </>
      )}

      <div className='pt-2 text-center'>{footer || t('receiptThanks')}</div>
    </div>
  )
}
