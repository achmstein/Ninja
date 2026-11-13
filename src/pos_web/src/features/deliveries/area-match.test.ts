import { describe, expect, it } from 'vitest'
import type { StaffDeliveryZone } from '@/api/ordering/types.gen'
import { matchAreas } from './area-match'

const area = (zoneId: number, en: string | null, ar: string | null, branchId = 1): StaffDeliveryZone => ({
  zoneId,
  branchId,
  name: { en, ar },
  fee: 25,
  minimumOrder: 0,
  etaMinutes: null,
  on: true,
  branchPaused: false,
  drawn: false,
})

const zones = [
  area(1, 'New Maadi', 'المعادي الجديدة'),
  area(2, 'Maadi Degla', 'دجلة المعادي'),
  area(3, 'Zamalek', 'الزمالك'),
  area(4, 'Old Maadi', null),
  area(5, null, 'مدينة نصر', 2),
]

const ids = (found: StaffDeliveryZone[]) => found.map((z) => z.zoneId)

describe('matchAreas', () => {
  it('lists the first few in the owner’s order when nothing is typed', () => {
    expect(ids(matchAreas(zones, '  ', 'en'))).toEqual([1, 2, 3, 4, 5])
    expect(ids(matchAreas(zones, '', 'en', 2))).toEqual([1, 2])
  })

  it('finds a name by any part of it, the one that starts with it first', () => {
    expect(ids(matchAreas(zones, 'maadi', 'en'))).toEqual([2, 1, 4])
    expect(ids(matchAreas(zones, 'lek', 'en'))).toEqual([3])
  })

  it('wants every word typed, in any order', () => {
    expect(ids(matchAreas(zones, 'degla maadi', 'en'))).toEqual([2])
    expect(ids(matchAreas(zones, 'maadi new', 'en'))).toEqual([1])
    expect(matchAreas(zones, 'maadi heliopolis', 'en')).toEqual([])
  })

  it('reads either language whatever the till is in', () => {
    expect(ids(matchAreas(zones, 'الزمالك', 'en'))).toEqual([3])
    expect(ids(matchAreas(zones, 'zama', 'ar'))).toEqual([3])
    expect(ids(matchAreas(zones, 'نصر', 'en'))).toEqual([5])
  })

  it('sets spelling variants aside: case, hyphens, alef and ta marbuta forms', () => {
    expect(ids(matchAreas(zones, 'MAADI-DEGLA', 'en'))).toEqual([2])
    expect(ids(matchAreas(zones, 'دجله', 'ar'))).toEqual([2])
    expect(ids(matchAreas(zones, 'ألزمالك', 'ar'))).toEqual([3])
  })

  it('puts a match on the name in the till’s language ahead of the same on the other', () => {
    const two = [area(1, 'Nasr', 'حي'), area(2, 'City', 'Nasr')]
    expect(ids(matchAreas(two, 'nasr', 'en'))).toEqual([1, 2])
    expect(ids(matchAreas(two, 'nasr', 'ar'))).toEqual([2, 1])
  })

  it('shows no more than asked', () => {
    const many = Array.from({ length: 20 }, (_, i) => area(i + 1, `Area ${i + 1}`, null))
    expect(matchAreas(many, 'area', 'en')).toHaveLength(8)
  })
})
