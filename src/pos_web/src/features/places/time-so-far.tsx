import type { StayViewModel } from '@/api/spaces/types.gen'
import { useMoney } from '@/lib/money'
import { estimateStayCost } from './status'
import { useSecondsClock } from './use-places'

/**
 * The running stay's cost so far, as money, ticking on its own clock so
 * the ticket around it does not re-render every second. Same figure the
 * stay card shows; the ticket repeats it where the bill is read (the
 * lines and the total), because the time is not on the bill until the
 * clock stops.
 */
export function TimeSoFar({ stay }: { stay: StayViewModel }) {
  const money = useMoney()
  const now = useSecondsClock(true)
  return <>{money(estimateStayCost(stay, now).amount)}</>
}
