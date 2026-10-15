import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { useBusinessTimeZone } from '@/lib/business-clock'
import {
  businessDayOffsetMinutes,
  parseDay,
  presetWindow,
  type BusinessHours,
  type DayWindow,
} from '@/lib/business-day'
import { type RangeKey, type RangeSearch } from '@/lib/search-schemas'

type Options = {
  /** What an absent `range` means (reports: today; history tables: all) */
  defaultPreset?: 'today' | 'all'
}

/**
 * The business-day window behind a report or history page, resolved from
 * the URL's preset (or custom days), the active branch's DayStart (a day
 * runs to the same time the next day) and the business's own time zone.
 * The APIs only take UTC bounds; the SPA owns the calendar, so no service
 * ever has to ask Tenant.API what a day is.
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

  const timeZone = useBusinessTimeZone()
  const preset: RangeKey = search.range ?? defaultPreset
  const isAll = preset === 'all'
  // Picked hours stand in for the branch's day (which has a start only)
  const hours = useMemo<BusinessHours | null>(
    () =>
      branch
        ? {
            dayStart: search.fromTime ?? branch.dayStartTime,
            dayEnd: search.toTime,
            timeZone,
          }
        : null,
    [branch, search.fromTime, search.toTime, timeZone]
  )
  const dayWindow = useMemo<DayWindow | null>(
    () =>
      hours && !isAll
        ? presetWindow(preset, hours, {
            from: parseDay(search.from),
            to: parseDay(search.to),
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours, preset, isAll, search.from, search.to, minuteTick]
  )

  return {
    branch,
    /** The branch's day start and the business's zone, for windows of its own */
    hours,
    timeZone,
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

/**
 * For endpoints that take only a fixed offset (tzOffsetMinutes) and count
 * "today" from that offset's midnight: the offset that makes their today
 * the active branch's business day. Undefined until the branch is known.
 */
export function useBusinessDayOffset(): number | undefined {
  const { hours } = useTillWindow({})
  const [minuteTick, setMinuteTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((v) => v + 1), 60_000)
    return () => clearInterval(timer)
  }, [])
  return useMemo(
    () => (hours ? businessDayOffsetMinutes(new Date(), hours) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours, minuteTick]
  )
}
