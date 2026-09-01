import { type LocalizedText } from '@/api/spaces'
import { useActiveSession } from '@/lib/session'
import { useActiveTable } from '@/stores/table-store'

export type OrderDestination =
  | { kind: 'room'; name: LocalizedText }
  | { kind: 'table'; id: number; name: LocalizedText }
  | null

/**
 * Where the next order will be delivered.
 *
 * A running room session beats a scanned table: the customer moved, and the
 * session is the stronger statement about where they physically are. A table
 * scanned earlier stays remembered and takes over again once the session ends.
 *
 * Every surface that shows or sends the destination reads it from here, so the
 * chip in the header cannot claim one thing while checkout sends another.
 */
export function useOrderDestination(): OrderDestination {
  const activeSession = useActiveSession()
  const activeTable = useActiveTable()

  if (activeSession?.roomName) {
    return { kind: 'room', name: activeSession.roomName }
  }
  if (activeTable) {
    return { kind: 'table', id: activeTable.id, name: activeTable.name }
  }
  return null
}
