import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { useFeatures } from '@/lib/brand'
import { useCallCentreStore } from '@/stores/call-centre-store'

/**
 * Whether this till may work as the call centre (the business has it, and
 * the account was given every branch), and whether it is doing so now.
 */
export function useCallCentre() {
  const features = useFeatures()
  const { holdsAllBranches } = useAllowedBranches()
  const on = useCallCentreStore((s) => s.on)
  const setOn = useCallCentreStore((s) => s.setOn)
  const available = features.callCentre === true && holdsAllBranches
  return { available, on: available && on, setOn }
}
