import { type LiveBills } from '@/lib/live-bills'
import { useLiveOrder } from '@/lib/live-order'
import { useActivePlace } from '@/stores/place-store'
import { hasLiveBill } from '@/components/bills/open-bills'

/** Whether the dock has a row to show: a bill running, an order on its way, or the table the customer sits at */
export function useDockRowShown(live: LiveBills): boolean {
  const stage = useLiveOrder((s) => s.stage)
  const place = useActivePlace()
  return hasLiveBill(live) || stage != null || place != null
}
