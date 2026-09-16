import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getActiveBranchId, useBranchStore } from './branch-store'

/** How long a scanned place stays attached to the customer. Long enough for a
 *  sitting with several rounds, short enough that yesterday's scan never
 *  mislabels today's order. */
export const TABLE_TTL_MS = 3 * 60 * 60 * 1000

/** The place the customer scanned to order at: a table, or a timed place
 *  they sat at without a clock running for them. */
export type StoredTable = {
  /** The Spaces place id — what orders and requests name */
  id: number
  /** PlaceKind: 1 room, 2 table, 3 station */
  kind: number
  /** Same shape as the API's LocalizedText, so it renders through useLocalized */
  name: { en?: string; ar?: string | null }
  branchId: number
  /** Refreshed on each order, so a long sitting does not expire mid-visit. */
  scannedAt: number
}

type TableState = {
  table: StoredTable | null
  setTable: (table: Omit<StoredTable, 'scannedAt'>) => void
  clearTable: () => void
  stampOrdered: () => void
}

export const useTableStore = create<TableState>()(
  persist(
    (set) => ({
      table: null,
      setTable: (table) => set({ table: { ...table, scannedAt: Date.now() } }),
      clearTable: () => set({ table: null }),
      stampOrdered: () =>
        set((state) =>
          state.table
            ? { table: { ...state.table, scannedAt: Date.now() } }
            : state,
        ),
    }),
    // A new storage key: what was stored before the Places remodel carried
    // the printed sticker's id, which is not the place id
    { name: 'chillax-place' },
  ),
)

/** A stored place only counts while it is fresh and belongs to the branch the
 *  customer is actually browsing. */
function isUsable(
  table: StoredTable | null,
  branchId: number,
): table is StoredTable {
  if (!table) return false
  if (Date.now() - table.scannedAt > TABLE_TTL_MS) return false
  return table.branchId === branchId
}

export function useActiveTable(): StoredTable | null {
  const table = useTableStore((s) => s.table)
  // Subscribed, not read once: switching branch has to re-evaluate this, or a
  // table from the branch just left keeps showing as the destination.
  const branchId = useBranchStore((s) => s.branchId)
  return isUsable(table, branchId) ? table : null
}

// For code outside the React tree
export function getActiveTable(): StoredTable | null {
  const { table } = useTableStore.getState()
  return isUsable(table, getActiveBranchId()) ? table : null
}
