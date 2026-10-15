import { useEffect, useState } from 'react'
import { useBrand } from './brand'
import { safeTimeZone } from './zoned-time'

/**
 * The business's own IANA zone, from the tenant snapshot every app boots
 * with (GET /api/tenant → locale.timeZone, the zone TenantClock keeps the
 * business's days in). Africa/Cairo when the tenant has not answered yet.
 */
export function useBusinessTimeZone(): string {
  return safeTimeZone(useBrand()?.locale?.timeZone)
}

/** The time now, ticking every `everyMs` so windows that hang off it roll over on their own. */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
