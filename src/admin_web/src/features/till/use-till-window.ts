import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import {
  parseDay,
  presetWindow,
  type DayWindow,
  type RangePreset,
} from '@/lib/business-day'
import { type RangeSearch } from './search'

/**
 * The business-day window behind a till page, resolved from the URL's preset
 * (or custom days) and the active branch's DayStart/DayEnd. Sales.API only
 * takes UTC bounds; the SPA owns the calendar, so Sales never has to ask
 * Branch.API what a day is.
 */
export function useTillWindow(search: RangeSearch) {
  const branchId = useBranchStore((s) => s.branchId)

  // Same query the sidebar branch switcher runs — served from the cache
  const { data: branches = [] } = useQuery(getBranchesOptions())
  const branch = branches.find((b) => Number(b.id) === branchId)

  // Re-evaluate every minute so "today" rolls over on its own. The ISO
  // bounds (and with them the query keys) only change at rollover.
  const [minuteTick, setMinuteTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((v) => v + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const preset: RangePreset = search.range ?? 'today'
  const dayWindow = useMemo<DayWindow | null>(
    () =>
      branch
        ? presetWindow(preset, branch.dayStartTime, branch.dayEndTime, {
            from: parseDay(search.from),
            to: parseDay(search.to),
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch, preset, search.from, search.to, minuteTick]
  )

  return {
    branch,
    preset,
    dayWindow,
    // '' keeps the query key stable while the window is still unknown
    fromIso: dayWindow?.from.toISOString() ?? '',
    toIso: dayWindow?.to.toISOString() ?? '',
  }
}
