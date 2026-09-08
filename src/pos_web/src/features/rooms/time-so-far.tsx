import type { ReservationViewModel, RoomViewModel } from '@/api/spaces/types.gen'
import { useMoney } from '@/lib/money'
import { estimateSessionCost } from './status'
import { useSecondsClock } from './use-rooms'

/**
 * The running session's cost so far, as money, ticking on its own clock so
 * the ticket around it does not re-render every second. Same figure the
 * session card shows; the ticket repeats it where the bill is read (the
 * lines and the total), because the time is not on the bill until the
 * session ends.
 */
export function TimeSoFar({
  session,
  room,
}: {
  session: ReservationViewModel
  room: RoomViewModel
}) {
  const money = useMoney()
  const now = useSecondsClock(true)
  return <>{money(estimateSessionCost(session, room, now).amount)}</>
}
