import { isOpen, useMyBills } from '@/lib/bills'
import { useActiveStay, useMyHold } from '@/lib/stays'
import { useActivePlace } from '@/stores/place-store'

/** Whether the customer is at the branch: an open bill, a held place, a running clock or a scanned table */
export function useAtBranch(): boolean {
  const { data: bills = [] } = useMyBills()
  const hold = useMyHold()
  const stay = useActiveStay()
  const place = useActivePlace()
  return bills.some(isOpen) || hold != null || stay != null || place != null
}
