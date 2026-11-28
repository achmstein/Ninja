import { type LiveBills } from '@/lib/live-bills'
import { useDockOrder } from '@/lib/live-order'
import { useActivePlace } from '@/stores/place-store'
import { useActiveStay } from '@/lib/stays'
import { hasLiveBill } from '@/components/bills/open-bills'

/** Whether the dock has a row to show: a bill running, an order on its way, or the table or room the customer is at */
export function useDockRowShown(live: LiveBills): boolean {
  // The preview's own order counts as one on its way (lib/dock-preview)
  const { stage } = useDockOrder()
  const place = useActivePlace()
  const stay = useActiveStay()
  return hasLiveBill(live) || stage != null || place != null || stay != null
}
