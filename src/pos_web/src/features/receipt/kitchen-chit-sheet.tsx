import { createPortal } from 'react-dom'
import type { OfflineSale } from '@/features/offline/offline-replay'
import { useLocale, useLocalized, useT } from '@/lib/i18n'

/**
 * The kitchen's copy of a sale taken while the server was out of reach:
 * with no server there are no kitchen tickets, so the till prints this one
 * on the same roll, on its own page after the receipt. What to make and how,
 * big enough to read from the pass; no prices.
 */
export function KitchenChitSheet({ sale }: { sale: OfflineSale }) {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()

  return createPortal(
    // The print stylesheet shows every .receipt-sheet; this one starts a new page
    <div className='receipt-sheet' style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{t('kitchenChit')}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{sale.provisionalReceiptNumber}</div>
        <div style={{ fontSize: 11 }}>
          {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
            new Date(sale.placedAt),
          )}
        </div>
        {sale.customerName && (
          <div style={{ fontSize: 13, fontWeight: 600 }}>{sale.customerName}</div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {sale.lines.map((line, index) => (
        <div key={index} style={{ marginBottom: '2mm' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {line.quantity} × {localized({ en: line.nameEn, ar: line.nameAr })}
          </div>
          {line.customizations.map((c) => (
            <div key={c.optionId} style={{ fontSize: 12, paddingInlineStart: '4mm' }}>
              {localized({ en: c.optionNameEn, ar: c.optionNameAr })}
            </div>
          ))}
          {line.specialInstructions && (
            <div style={{ fontSize: 12, paddingInlineStart: '4mm', fontStyle: 'italic' }}>
              {line.specialInstructions}
            </div>
          )}
        </div>
      ))}

      {sale.note.trim() && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
          <div style={{ fontSize: 12 }}>{sale.note.trim()}</div>
        </>
      )}
    </div>,
    document.body,
  )
}
