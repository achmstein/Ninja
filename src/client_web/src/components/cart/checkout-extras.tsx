import type { CheckoutExtras } from '@/lib/use-checkout-extras'
import { NoteRow, PointsRow, PromoRow } from './savings'
import { POINTS_STEP } from './savings-model'

/** The note, the promo code and the points, as rows: the tray's order and the order page both show them */
export function CheckoutExtrasRows({ extras }: { extras: CheckoutExtras }) {
  const { promo, points } = extras
  return (
    <>
      <NoteRow note={extras.note} onNote={extras.setNote} />
      <PromoRow code={promo.code} reason={promo.reason} checking={promo.checking} onApply={promo.apply} onClear={promo.clear} />
      {points.offered && (
        <PointsRow
          active={points.active}
          points={points.count}
          max={points.max}
          balance={points.balance}
          onPoints={points.setCount}
          onActive={(checked) => {
            points.setActive(checked)
            points.setCount(checked ? Math.min(POINTS_STEP, points.max) : 0)
          }}
        />
      )}
    </>
  )
}
