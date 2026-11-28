import { type LiveBills } from '@/lib/live-bills'
import { useLiveOrder } from '@/lib/live-order'
import { useDockPreview } from '@/lib/dock-preview'
import { useActivePlace } from '@/stores/place-store'
import { useActiveStay } from '@/lib/stays'
import { hasLiveBill } from '@/components/bills/open-bills'

/** Whether the dock has a row to show: a bill running, an order on its way, or the table or room the customer is at */
export function useDockRowShown(live: LiveBills): boolean {
  const stage = useLiveOrder((s) => s.stage)
  const place = useActivePlace()
  const stay = useActiveStay()
  // The preview's own order counts as one on its way (lib/dock-preview)
  const previewed = useDockPreview((s) => (s.on ? s.stage : null))
  return hasLiveBill(live) || stage != null || previewed != null || place != null || stay != null
}
