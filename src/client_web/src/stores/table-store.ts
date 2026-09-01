import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getActiveBranchId } from './branch-store'

/** How long a scanned table stays attached to the customer. Long enough for a
 *  sitting with several rounds, short enough that yesterday's scan never
 *  mislabels today's order. */
export const TABLE_TTL_MS = 3 * 60 * 60 * 1000

export type StoredTable = {
  id: number
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
            : state
        ),
    }),
    { name: 'chillax-table' }
  )
)

/** A stored table only counts while it is fresh and belongs to the branch the
 *  customer is actually browsing. */
function isUsable(table: StoredTable | null): table is StoredTable {
  if (!table) return false
  if (Date.now() - table.scannedAt > TABLE_TTL_MS) return false
  return table.branchId === getActiveBranchId()
}

export function useActiveTable(): StoredTable | null {
  const table = useTableStore((s) => s.table)
  return isUsable(table) ? table : null
}

// For code outside the React tree
export function getActiveTable(): StoredTable | null {
  const { table } = useTableStore.getState()
  return isUsable(table) ? table : null
}
