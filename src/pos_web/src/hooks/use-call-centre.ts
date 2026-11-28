import { useAllowedBranches } from '@ninja/web-core/branches'
import { useCallCentreStore } from '@/stores/call-centre-store'
import { useFeatures } from '@/lib/brand'

/**
 * Whether this till may work as the call centre (the business has it, and
 * the account holds every branch: given them all, or an owner, who always
 * does, as the till app has it), and whether it is doing so now.
 */
export function useCallCentre() {
  const features = useFeatures()
  const { holdsAllBranches, isOwner } = useAllowedBranches()
  const on = useCallCentreStore((s) => s.on)
  const setOn = useCallCentreStore((s) => s.setOn)
  const available = features.callCentre === true && (holdsAllBranches || isOwner)
  return { available, on: available && on, setOn }
}
