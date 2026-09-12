import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { parseDay, presetWindow, type DayWindow } from '@/lib/business-day'
import { type RangeKey, type RangeSearch } from '@/lib/search-schemas'

type Options = {
  /** What an absent `range` means (reports: today; history tables: all) */
  defaultPreset?: 'today' | 'all'
}

/**
 * The business-day window behind a report or history page, resolved from
 * the URL's preset (or custom days) and the active branch's DayStart/DayEnd.
 * The APIs only take UTC bounds; the SPA owns the calendar, so no service
 * ever has to ask Branch.API what a day is.
 */
export function useTillWindow(
  search: RangeSearch,
  { defaultPreset = 'today' }: Options = {}
) {
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

  const preset: RangeKey = search.range ?? defaultPreset
  const isAll = preset === 'all'
  const dayWindow = useMemo<DayWindow | null>(
    () =>
      branch && !isAll
        ? presetWindow(preset, branch.dayStartTime, branch.dayEndTime, {
            from: parseDay(search.from),
            to: parseDay(search.to),
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch, preset, isAll, search.from, search.to, minuteTick]
  )

  return {
    branch,
    preset,
    /** True when the page spans everything and no window applies */
    isAll,
    dayWindow,
    /** The branch is known, so the window (or "all") is final */
    ready: branch != null,
    // '' keeps the query key stable while the window is still unknown
    fromIso: dayWindow?.from.toISOString() ?? '',
    toIso: dayWindow?.to.toISOString() ?? '',
  }
}
