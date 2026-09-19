import { createPortal } from 'react-dom'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useBrand, useBrandName } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'

export type TabPaymentSlip = {
  /** 0 when the slip was already recorded by an earlier attempt. */
  number: number
  customerName: string
  tender: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  at: Date
}

const row = { display: 'flex', justifyContent: 'space-between', gap: 8 } as const

/**
 * The 80mm slip for a tab payment — the customer's proof that money came
 * off their tab. Same print mechanics as the receipt: portaled to <body>,
 * painted alone by the `.receipt-sheet` print stylesheet.
 */
export function TabPaymentSheet({ slip }: { slip: TabPaymentSlip }) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const brand = useBrand()
  const brandName = useBrandName()

  const key = tenderLabelKey[slip.tender]
  const tenderLabel = key ? t(key) : slip.tender

  return createPortal(
    <div className='receipt-sheet'>
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        {/* The English wordmark (paper is white), the mark without one, the name without either */}
        {(brand?.wordmarks.en?.url ?? brand?.logoUrl) ? (
          <img
            src={brand?.wordmarks.en?.url ?? brand?.logoUrl ?? undefined}
            alt=''
            style={{ width: '36mm', height: 'auto', margin: '0 auto 2mm', display: 'block' }}
          />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: '2mm' }}>{brandName}</div>
        )}
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t('tabPaymentSlip')}</div>
        {slip.number > 0 && (
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t('tabPaymentNumber', { number: slip.number })}
          </div>
        )}
        <div style={{ fontSize: 11 }}>
          {t('receiptDate')}:{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(slip.at)}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      <div style={row}>
        <span>{t('customerCard')}</span>
        <span>{slip.customerName || t('guest')}</span>
      </div>
      <div style={row}>
        <span>{t('tabBalanceBefore')}</span>
        <span>{money(slip.balanceBefore)}</span>
      </div>
      <div style={{ ...row, fontSize: 15, fontWeight: 700 }}>
        <span>{tenderLabel}</span>
        <span>−{money(slip.amount)}</span>
      </div>
      <div style={{ ...row, fontWeight: 600 }}>
        <span>{t('newBalance')}</span>
        <span>{money(Math.max(0, slip.balanceAfter))}</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: 12 }}>
        {t('receiptThanks')}
      </div>
    </div>,
    document.body
  )
}
