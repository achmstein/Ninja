import { z } from 'zod'
import { fromLocalizedValue, type LocalizedValue } from '@/lib/localized-value'
import {
  areaProblem,
  areaToApi,
  type AreaProblem,
  type DeliveryArea,
  type LatLng,
} from '@/lib/maps'

/** The rules the server holds a branch's list of named areas to */
export const MAX_ZONES = 100
export const MAX_ZONE_NAME = 80
export const MIN_ZONE_MINUTES = 5
export const MAX_ZONE_MINUTES = 240
const MAX_AMOUNT = 1_000_000

/** One named area as the owner types it */
export interface ZoneInput {
  /** The saved area this row is, or null for one just added */
  id: number | null
  name: LocalizedValue
  fee: string
  /** Blank: the branch's own minimum */
  minimum: string
  /** Blank: no time is promised */
  minutes: string
  isOn: boolean
  shape: DeliveryArea | null
}

/** One named area as the server takes it */
export interface Zone {
  id: number | null
  name: { en: string | null; ar: string | null }
  fee: number
  minimumOrder: number | null
  etaMinutes: number | null
  isOn: boolean
  shape: number[][] | null
}

export type ZoneNameProblem = 'required' | 'tooLong' | 'duplicate'
/** A shape's own problem, or a shape on a branch that is not on the map */
export type ZoneShapeProblem = AreaProblem | 'needsLocation'

/** What is wrong with one row; empty when nothing is */
export interface ZoneErrors {
  name?: ZoneNameProblem
  fee?: true
  minimum?: true
  minutes?: true
  shape?: ZoneShapeProblem
}

/** A typed number, the decimal comma read as a point */
const typed = (s: string) => s.trim().replace(',', '.')

/** Blank is 0: delivering there is free */
const amount = z
  .string()
  .transform((s) => (typed(s) === '' ? 0 : Number(typed(s))))
  .pipe(z.number().min(0).max(MAX_AMOUNT))

/** Blank is null: the branch's own holds */
const optionalAmount = z
  .string()
  .transform((s) => (typed(s) === '' ? null : Number(typed(s))))
  .pipe(z.number().min(0).max(MAX_AMOUNT).nullable())

const optionalMinutes = z
  .string()
  .transform((s) => (typed(s) === '' ? null : Number(typed(s))))
  .pipe(z.number().int().min(MIN_ZONE_MINUTES).max(MAX_ZONE_MINUTES).nullable())

/** The numbers of one area, as the owner types them */
export const zoneAmountsSchema = z.object({
  fee: amount,
  minimum: optionalAmount,
  minutes: optionalMinutes,
})

const nameProblem = (name: Zone['name']): ZoneNameProblem | undefined => {
  if (!name.en && !name.ar) return 'required'
  if (
    (name.en?.length ?? 0) > MAX_ZONE_NAME ||
    (name.ar?.length ?? 0) > MAX_ZONE_NAME
  )
    return 'tooLong'
  return undefined
}

/**
 * The rows whose name another row also has, in either language and whatever
 * the case: an agent typing a name must land on one area and one fee
 */
function duplicates(names: Zone['name'][]): Set<number> {
  const owners = new Map<string, number>()
  const found = new Set<number>()
  names.forEach((name, index) => {
    for (const text of new Set(
      [name.en, name.ar].filter((n) => n != null).map((n) => n.toLowerCase())
    )) {
      const first = owners.get(text)
      if (first == null) owners.set(text, index)
      else found.add(first).add(index)
    }
  })
  return found
}

/**
 * The list as the server takes it, in the order given, or what is wrong with
 * each row (and whether there are too many). `centre` is where the branch is
 * on the map: a shape cannot be kept without it.
 */
export function parseDeliveryZones(
  inputs: ZoneInput[],
  centre: LatLng | null
):
  | { ok: true; value: Zone[] }
  | { ok: false; errors: ZoneErrors[]; tooMany: boolean } {
  const names = inputs.map((input) => fromLocalizedValue(input.name))
  const repeated = duplicates(names)
  const value: Zone[] = []
  const errors: ZoneErrors[] = inputs.map((input, index) => {
    const wrong: ZoneErrors = {}
    const name = nameProblem(names[index])
    if (name) wrong.name = name
    else if (repeated.has(index)) wrong.name = 'duplicate'

    const amounts = zoneAmountsSchema.safeParse(input)
    if (!amounts.success)
      for (const issue of amounts.error.issues) {
        const field = issue.path[0]
        if (field === 'fee' || field === 'minimum' || field === 'minutes')
          wrong[field] = true
      }

    if (input.shape) {
      const shape = centre ? areaProblem(input.shape, centre) : 'needsLocation'
      if (shape) wrong.shape = shape
    }

    if (amounts.success)
      value.push({
        id: input.id,
        name: names[index],
        fee: amounts.data.fee,
        minimumOrder: amounts.data.minimum,
        etaMinutes: amounts.data.minutes,
        isOn: input.isOn,
        shape: input.shape ? areaToApi(input.shape) : null,
      })
    return wrong
  })

  const tooMany = inputs.length > MAX_ZONES
  if (tooMany || errors.some((wrong) => Object.keys(wrong).length > 0))
    return { ok: false, errors, tooMany }
  return { ok: true, value }
}
