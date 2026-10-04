import { useState } from 'react'
import { useTillDeliveryQuote } from '@/features/deliveries/use-deliveries'
import { useFeatures } from '@/lib/brand'
import { toNumber } from '@/lib/money'
import { isModuleOff } from '@/lib/problem'
import { useSale } from './cart'
import { deliveryReadiness } from './sale-delivery'

/**
 * A walk-in sale that goes out with a rider instead: whether the till may
 * offer it, whether one on the sale can go now, and what it adds. The cart
 * says whether the sale is a delivery; the branch's terms only say whether it
 * can go, and while they can't (being read, unreadable, delivery off) the
 * sale waits rather than going out as a counter sale. A round on an open bill
 * is never a delivery.
 */
export function useSaleDelivery(addingToTicket: boolean) {
  const features = useFeatures()
  const { delivery, setDelivery, customer, setCustomer } = useSale()
  const [formOpen, setFormOpen] = useState(false)
  const onSale = addingToTicket ? null : delivery
  // Asked where the business delivers, and for a delivery already on the sale whatever the switch says
  const terms = useTillDeliveryQuote('', !addingToTicket && (features.delivery === true || onSale != null))
  const off = terms.isError && isModuleOff(terms.error)
  const readiness = deliveryReadiness(
    onSale,
    { isLoading: terms.isLoading, isError: terms.isError && !off, delivers: off ? false : terms.data?.delivers },
    features.delivery === true,
  )

  return {
    delivery: onSale,
    /** The Delivery button: only where the business and this branch deliver */
    canOffer: !addingToTicket && features.delivery === true && terms.data?.delivers === true,
    /** A delivery is on the sale (ready or not): the sale is charged as one or not at all */
    delivering: onSale != null,
    readiness,
    /** What the delivery adds to the total, once its terms are known */
    fee: readiness === 'ready' ? toNumber(terms.data?.fee) : 0,
    formOpen,
    setFormOpen,
    retry: () => void terms.refetch(),
    remove: () => setDelivery(null),
    save: (saved: NonNullable<typeof delivery>, name: string) => {
      setDelivery(saved)
      // A caller off the street is known by the name they gave
      if (!customer?.id) setCustomer({ id: null, name, phone: saved.phone })
      setFormOpen(false)
    },
  }
}
