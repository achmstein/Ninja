import { createPortal } from 'react-dom'
import type { ShiftView } from '@/api/sales/types.gen'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useBrandName } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { drawerFormula } from './drawer'

/**
 * The 80mm printable shift report (Z for a closed shift, X otherwise) —
 * same mechanics as the receipt: portaled to <body>, hidden on screen, and
 * the print stylesheet paints only `.receipt-sheet`. Localized to the
 * active UI language.
 */
export function ShiftReportSheet({ shift }: { shift: ShiftView }) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const brandName = useBrandName()

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''
  // Movements are inside the shift printed above: time only
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })
  const formatTime = (value: string | null | undefined) =>
    value ? time.format(new Date(value)) : ''

  const closed = shift.status === 'Closed'
  const overShort = toNumber(shift.overShort)
  const tenders = shift.tenderTotals ?? []
  const tabPayments = shift.tabPaymentTenderTotals ?? []
  const movements = shift.movements ?? []
  const drawer = drawerFormula(shift)
  const overShortText = (value: number) =>
    value === 0
      ? t('drawerBalanced')
      : `${t(value > 0 ? 'drawerOver' : 'drawerShort')} ${money(Math.abs(value))}`

  const row = (
    label: string,
    value: string,
    options?: { bold?: boolean; size?: number }
  ) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        fontWeight: options?.bold ? 700 : 400,
        fontSize: options?.size,
      }}
    >
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )

  const dashed = <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

  return createPortal(
    <div className='receipt-sheet'>
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{brandName}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {t(closed ? 'zReportTitle' : 'xReportTitle')}
        </div>
        <div style={{ fontSize: 12 }}>
          {t('shiftNumber', { id: toNumber(shift.id) })}
        </div>
      </div>

      <div style={{ fontSize: 11 }}>
        {row(t('openedAt'), formatAt(shift.openedAt))}
        {shift.openedBy && row(t('openedBy'), shift.openedBy)}
        {closed && row(t('closedAt'), formatAt(shift.closedAt))}
        {closed && shift.closedBy != null && row(t('closedBy'), shift.closedBy)}
      </div>

      {dashed}

      {row(t('ticketsSettled'), String(toNumber(shift.ticketsSettled)))}
      {row(t('grossSales'), money(shift.grossSales ?? shift.salesTotal), { bold: true })}
      {row(t('discount'), money(shift.discounts))}
      {row(t('refundsIssued'), money(shift.refundsTotal))}
      {row(t('netSales'), money(shift.netSales ?? shift.salesTotal), { bold: true })}
      {row(t('changeGiven'), money(shift.changeGiven))}

      {dashed}
      <div style={{ fontWeight: 600 }}>{t('drawerFormula')}</div>
      {drawer.terms.map((term) =>
        row(t(term.key), `${term.sign < 0 ? '−' : '+'}${money(term.amount)}`)
      )}
      {row(t('expectedInDrawer'), `= ${money(drawer.expected)}`, { bold: true })}
      {drawer.lateCash !== 0 && row(t('lateCash'), money(drawer.lateCash))}
      {drawer.lateCash !== 0 &&
        drawer.adjustedOverShort != null &&
        row(t('adjustedOverShort'), overShortText(drawer.adjustedOverShort))}

      {tenders.length > 0 && (
        <>
          {dashed}
          <div style={{ fontWeight: 600 }}>{t('billsByTender')}</div>
          {tenders.map((total) =>
            row(
              `${
                tenderLabelKey[total.tender]
                  ? t(tenderLabelKey[total.tender])
                  : total.tender
              } × ${toNumber(total.count)}`,
              money(total.amount)
            )
          )}
        </>
      )}

      {tabPayments.length > 0 && (
        <>
          {dashed}
          <div style={{ fontWeight: 600 }}>{t('tabPayments')}</div>
          {tabPayments.map((total) =>
            row(
              `${
                tenderLabelKey[total.tender]
                  ? t(tenderLabelKey[total.tender])
                  : total.tender
              } × ${toNumber(total.count)}`,
              money(total.amount)
            )
          )}
        </>
      )}

      {movements.length > 0 && (
        <>
          {dashed}
          <div style={{ fontWeight: 600 }}>{t('drawerMovements')}</div>
          {movements.map((movement, index) => (
            <div key={index}>
              {row(
                movement.reason,
                `${movement.type === 'PayOut' ? '−' : '+'}${money(movement.amount)}`
              )}
              <div style={{ fontSize: 10 }}>
                <bdi>{movement.recordedBy}</bdi> ·{' '}
                <bdi>{formatTime(movement.recordedAt)}</bdi>
              </div>
            </div>
          ))}
        </>
      )}

      {dashed}

      {closed ? (
        <>
          {row(t('expected'), money(shift.expectedCash ?? shift.expectedInDrawer), {
            bold: true,
            size: 13,
          })}
          {row(t('counted'), money(shift.closingCount), { bold: true, size: 13 })}
          {row(
            t('overShort'),
            overShortText(overShort),
            { bold: true, size: 15 }
          )}
        </>
      ) : (
        row(t('expectedInDrawer'), money(shift.expectedInDrawer), {
          bold: true,
          size: 15,
        })
      )}
    </div>,
    document.body
  )
}
