import { createPortal } from 'react-dom'
import type { ShiftView } from '@/api/sales/types.gen'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

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

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''

  const closed = shift.status === 'Closed'
  const overShort = toNumber(shift.overShort)
  const tenders = shift.tenderTotals ?? []
  const tabPayments = shift.tabPaymentTenderTotals ?? []
  const movements = shift.movements ?? []

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
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('brandName')}</div>
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

      {row(t('openingFloat'), money(shift.openingFloat))}
      {row(t('ticketsSettled'), String(toNumber(shift.ticketsSettled)))}
      {row(t('salesTotal'), money(shift.salesTotal), { bold: true })}
      {row(t('changeGiven'), money(shift.changeGiven))}
      {row(t('payInsTotal'), money(shift.payInsTotal))}
      {row(t('payOutsTotal'), money(shift.payOutsTotal))}

      {tenders.length > 0 && (
        <>
          {dashed}
          <div style={{ fontWeight: 600 }}>{t('tenderSplit')}</div>
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
                {movement.recordedBy} · {formatAt(movement.recordedAt)}
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
            overShort === 0
              ? t('drawerBalanced')
              : `${t(overShort > 0 ? 'drawerOver' : 'drawerShort')} ${money(Math.abs(overShort))}`,
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
