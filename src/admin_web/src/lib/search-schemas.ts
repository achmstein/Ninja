import { z } from 'zod'
import { rangePresets, type RangePreset } from '@/lib/business-day'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** A business-day preset, or `all` on history pages that can span everything */
export type RangeKey = RangePreset | 'all'

// The business-day window shared by every report/history page. `from`/`to`
// are calendar days (yyyy-MM-dd) and only matter for the custom preset.
export const rangeSearch = {
  range: z.enum([...rangePresets, 'all']).optional(),
  from: day.optional(),
  to: day.optional(),
}

export const pagedSearch = {
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
}

export type RangeSearch = {
  range?: RangeKey
  from?: string
  to?: string
}
