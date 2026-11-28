import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBranchStore } from '@/stores/branch-store'
import { useStationStore } from '@/stores/station-store'
import { boardQueries } from './api/queries'

/**
 * The branch's stations that show on a screen — the ones a kitchen display
 * can be — and the one this display is. A pick the back office has since
 * removed or moved to a printer falls back to the pass rather than showing
 * an empty board.
 */
export function useStation() {
  const branchId = useBranchStore((s) => s.branchId)
  const picked = useStationStore((s) => (branchId == null ? null : (s.byBranch[branchId] ?? null)))
  const setStation = useStationStore((s) => s.setStation)

  const query = useQuery({ ...boardQueries.stations(), enabled: branchId != null })

  const screens = useMemo(() => (query.data ?? []).filter((s) => s.showsOnScreen), [query.data])

  const station = screens.find((s) => Number(s.id) === picked) ?? null

  return {
    /** Null on the pass. */
    stationId: station ? Number(station.id) : null,
    station,
    screens,
    /** A choice only means something with two screens to choose between. */
    canChoose: screens.length > 1,
    setStationId: (stationId: number | null) => {
      if (branchId != null) setStation(branchId, stationId)
    },
  }
}
