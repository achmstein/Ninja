import { useEffect } from 'react'
import { type LocalizedText } from '@/api/spaces'
import { useActiveSession } from '@/lib/session'
import { useActiveTable, useTableStore } from '@/stores/table-store'

export type OrderDestination =
  | { kind: 'room'; name: LocalizedText; sessionId: number; roomId: number }
  | { kind: 'table'; id: number; name: LocalizedText }
  | null

/**
 * Where the next order will be delivered.
 *
 * A running room session beats a scanned table, and forgets it: moving to a
 * room means the customer left the table, so when the session ends they have no
 * destination until they scan wherever they sit next. Keeping the old table
 * warm would risk sending food to a table they had already walked away from.
 *
 * Clearing is driven by the session appearing rather than by the join button,
 * so it also covers a session a cashier starts for a walk-in - where the
 * customer never taps anything in the app.
 *
 * Every surface that shows or sends the destination reads it from here, so the
 * chip in the header cannot claim one thing while checkout sends another.
 */
export function useOrderDestination(): OrderDestination {
  const activeSession = useActiveSession()
  const activeTable = useActiveTable()
  const clearTable = useTableStore((s) => s.clearTable)

  const inRoom = Boolean(activeSession?.roomName)

  useEffect(() => {
    if (inRoom && activeTable) clearTable()
  }, [inRoom, activeTable, clearTable])

  if (activeSession?.roomName) {
    // The ids ride along so the order can be joined to the session's bill
    // server-side; the name stays what staff and receipts display
    return {
      kind: 'room',
      name: activeSession.roomName,
      sessionId: Number(activeSession.id),
      roomId: Number(activeSession.roomId),
    }
  }
  if (activeTable) {
    return { kind: 'table', id: Number(activeTable.id), name: activeTable.name }
  }
  return null
}
