import { z } from 'zod'
import { rangePresets, type RangePreset } from '@/lib/business-day'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// The business-day window every till page shares. `from`/`to` are calendar
// days (yyyy-MM-dd) and only matter for the custom preset.
export const rangeSearch = {
  range: z.enum(rangePresets).optional(),
  from: day.optional(),
  to: day.optional(),
}

export const pagedSearch = {
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
}

export type RangeSearch = {
  range?: RangePreset
  from?: string
  to?: string
}
