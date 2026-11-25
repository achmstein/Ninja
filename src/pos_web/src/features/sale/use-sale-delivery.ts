import { useEffect, useState } from 'react'
import { useTillDeliveryQuote } from '@/features/deliveries/use-deliveries'
import { useFeatures } from '@/lib/brand'
import { translate } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { isModuleOff } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { useSale, type SaleCustomer } from './cart'
import { chargedZone, deliveryFeeOf, deliveryReadiness, zoneGone } from './sale-delivery'

/**
 * A walk-in sale that goes out with a rider instead: whether the till may
 * offer it, whether one on the sale can go now, and what it adds. The cart
 * says whether the sale is a delivery; the branch's terms only say whether it
 * can go, and while they can't (being read, unreadable, delivery off) the
 * sale waits rather than going out as a counter sale. A round on an open bill
 * is never a delivery. One to a named area is charged that area's fee: the
 * terms are asked for the area, and for the pin when no area was picked, the
 * way the order itself is priced.
 */
export function useSaleDelivery(addingToTicket: boolean) {
  const features = useFeatures()
  const { delivery, setDelivery, customer, setCustomer } = useSale()
  const [formOpen, setFormOpen] = useState(false)
  const onSale = addingToTicket ? null : delivery
  // The named area it is charged for, and without one the pin: the server reads the area the pin is in
  const zone = chargedZone(onSale)
  const pin =
    onSale && !onSale.sendTo && !zone && onSale.latitude != null && onSale.longitude != null
      ? `${onSale.latitude}, ${onSale.longitude}`
      : ''
  // Asked where the business delivers, and for a delivery already on the sale whatever the switch says
  const terms = useTillDeliveryQuote(pin, !addingToTicket && (features.delivery === true || onSale != null), zone?.id ?? null)
  // The owner took the area off the list since it was picked: the branch's own fee holds, and the cashier is told
  const gone = onSale != null && terms.data?.delivers === true && !terms.isFetching && zoneGone(zone, terms.data.zoneId)
  useEffect(() => {
    if (!gone) return
    const current = useSale.getState().delivery
    if (!current?.zone) return
    setDelivery({ ...current, zone: null })
    toast.warning(translate('deliveryAreaGone'))
  }, [gone, setDelivery])
  const off = terms.isError && isModuleOff(terms.error)
  const readiness = deliveryReadiness(
    onSale,
    // Still the terms of the pin before: the fee shown would be another place's
    { isLoading: terms.isLoading || terms.answeredFor !== pin, isError: terms.isError && !off, delivers: off ? false : terms.data?.delivers },
    features.delivery === true,
  )

  return {
    delivery: onSale,
    /**
     * The Delivery button: wherever the business delivers, never hidden while
     * the branch's terms are read. A branch that doesn't deliver, or terms that
     * couldn't be read, are said in the form with the way out
     */
    canOffer: !addingToTicket && features.delivery === true,
    /** A delivery is on the sale (ready or not): the sale is charged as one or not at all */
    delivering: onSale != null,
    readiness,
    /** What the delivery adds to the total, once its terms are known: the fee of the branch that delivers it */
    fee: readiness === 'ready' ? deliveryFeeOf(onSale, toNumber(terms.data?.fee)) : 0,
    /** The branch it is sent to, nearer the caller; null when it is made here */
    sendTo: onSale?.sendTo ?? null,
    formOpen,
    setFormOpen,
    retry: () => void terms.refetch(),
    remove: () => setDelivery(null),
    /** Made and delivered here after all, not sent to the nearer branch */
    keepHere: () => {
      if (delivery) setDelivery({ ...delivery, sendTo: null })
    },
    /**
     * The delivery onto the sale, and who it is for: the account the form found
     * by the number (or the one already on the sale), else the name the caller
     * gave. The customer is said once, in the form, never again on the pad
     */
    save: (saved: NonNullable<typeof delivery>, who: SaleCustomer) => {
      setDelivery(saved)
      if (who.id || !customer?.id) setCustomer(who.id ? who : { id: null, name: who.name, phone: saved.phone })
      setFormOpen(false)
    },
  }
}
