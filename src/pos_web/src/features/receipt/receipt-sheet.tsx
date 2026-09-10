import { createPortal } from 'react-dom'
import type { TicketDetail } from '@/api/sales/types.gen'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { tenderLabelKey } from '@/features/ticket/tenders'

export type ReceiptPayment = {
  tender: string
  amount: number
}

type ReceiptSheetProps = {
  ticket: TicketDetail
  // Right after settling, the refetched ticket may not have landed yet;
  // the settle dialog passes what it knows so Print works immediately.
  paymentsOverride?: ReceiptPayment[]
  receiptNumberOverride?: number
}

const row = { display: 'flex', justifyContent: 'space-between', gap: 8 } as const

const percent = (rate: number | string | undefined) =>
  Math.round(toNumber(rate) * 10000) / 100

/**
 * The 80mm printable receipt. Portaled to <body> and hidden on screen; the
 * print stylesheet in styles/index.css hides everything else and paints
 * only this (see `.receipt-sheet`). Localized to the active UI language.
 * The money block is the frozen bill: subtotal, service, VAT (shown out of
 * an inclusive price, or added on top), total — then what was paid and any
 * credit notes issued since.
 */
export function ReceiptSheet({
  ticket,
  paymentsOverride,
  receiptNumberOverride,
}: ReceiptSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()

  const payments: ReceiptPayment[] =
    paymentsOverride ??
    (ticket.payments ?? []).map((p) => ({
      tender: p.tender ?? '',
      amount: toNumber(p.amount),
    }))

  const total = toNumber(ticket.total)
  const subtotal = toNumber(ticket.subtotal)
  const service = toNumber(ticket.serviceCharge)
  const vat = toNumber(ticket.vat)
  const hasBreakdown = service > 0 || vat > 0
  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  const change = Math.max(0, paid - total)
  const receiptNumber = receiptNumberOverride ?? ticket.receiptNumber
  const date = ticket.settledAt ? new Date(ticket.settledAt) : new Date()
  const refunds = ticket.refunds ?? []

  const tenderLabel = (tender: string) => {
    const key = tenderLabelKey[tender]
    return key ? t(key) : tender
  }

  return createPortal(
    <div className='receipt-sheet'>
      {/* TODO(pos-plan phase 2): print the branch name once receipts carry it */}
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        {/* The wordmark, about half the paper wide, as the tablet till prints it */}
        <img
          src='/images/logo.png'
          alt={t('brandName')}
          style={{ width: '36mm', height: 'auto', margin: '0 auto 2mm', display: 'block' }}
        />
        {receiptNumber != null && (
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t('receiptNumber', { number: toNumber(receiptNumber) })}
          </div>
        )}
        <div style={{ fontSize: 11 }}>
          {t('receiptDate')}:{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(date)}
        </div>
        {localized(ticket.locationName) && (
          <div style={{ fontSize: 11 }}>{localized(ticket.locationName)}</div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {(ticket.lines ?? []).map((line) => (
        <div key={String(line.id)} style={{ marginBottom: '1.5mm' }}>
          <div style={row}>
            <span>{localized(line.description)}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{money(line.total)}</span>
          </div>
          <div style={{ fontSize: 10, color: '#000' }}>
            {toNumber(line.qty)} × {money(line.unitPrice)}
            {toNumber(line.discount) > 0 &&
              ` − ${money(line.discount)} (${t('discount')})`}
          </div>
          {localized(line.details) && (
            <div style={{ fontSize: 10 }}>{localized(line.details)}</div>
          )}
        </div>
      ))}

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {hasBreakdown && (
        <div style={{ fontSize: 11 }}>
          <div style={row}>
            <span>{t('subtotal')}</span>
            <span>{money(subtotal)}</span>
          </div>
          {service > 0 && (
            <div style={row}>
              <span>
                {t('serviceCharge', { rate: percent(ticket.serviceChargeRate) })}
              </span>
              <span>{money(service)}</span>
            </div>
          )}
          {vat > 0 && !ticket.vatIncluded && (
            <div style={row}>
              <span>{t('vat', { rate: percent(ticket.vatRate) })}</span>
              <span>{money(vat)}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ ...row, fontSize: 15, fontWeight: 700 }}>
        <span>{t('total')}</span>
        <span>{money(total)}</span>
      </div>

      {vat > 0 && ticket.vatIncluded && (
        <div style={{ ...row, fontSize: 10 }}>
          <span>{t('vatIncluded', { rate: percent(ticket.vatRate) })}</span>
          <span>{money(vat)}</span>
        </div>
      )}

      {payments.map((payment, index) => (
        <div key={index} style={row}>
          <span>{tenderLabel(payment.tender)}</span>
          <span>{money(payment.amount)}</span>
        </div>
      ))}
      {change > 0 && (
        <div style={{ ...row, fontWeight: 600 }}>
          <span>{t('changeDue')}</span>
          <span>{money(change)}</span>
        </div>
      )}

      {refunds.length > 0 && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
          {refunds.map((refund) => (
            <div key={String(refund.id)} style={{ marginBottom: '1mm' }}>
              <div style={row}>
                <span>{t('creditNote', { number: toNumber(refund.number) })}</span>
                <span>−{money(refund.amount)}</span>
              </div>
              <div style={{ fontSize: 10 }}>{refund.reason}</div>
            </div>
          ))}
          <div style={{ ...row, fontWeight: 600 }}>
            <span>{t('refundedSoFar')}</span>
            <span>−{money(ticket.refundedTotal)}</span>
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: 12 }}>
        {t('receiptThanks')}
      </div>
    </div>,
    document.body
  )
}
