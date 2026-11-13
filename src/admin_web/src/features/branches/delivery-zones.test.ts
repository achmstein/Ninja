import { describe, expect, it } from 'vitest'
import { parseDeliveryZones, type ZoneInput } from './delivery-zones'

const centre = { lat: 30.0444, lng: 31.2357 }

const zone = (over: Partial<ZoneInput> = {}): ZoneInput => ({
  id: null,
  name: { en: 'Maadi Degla', ar: '' },
  fee: '25',
  minimum: '',
  minutes: '',
  isOn: true,
  shape: null,
  ...over,
})

/** A small triangle beside the branch */
const triangle = [
  { lat: 30.05, lng: 31.23 },
  { lat: 30.05, lng: 31.25 },
  { lat: 30.06, lng: 31.24 },
]

describe('parseDeliveryZones', () => {
  it('reads a valid list in its order, as the server takes it', () => {
    const parsed = parseDeliveryZones(
      [
        zone({
          id: 7,
          name: { en: ' Maadi Degla ', ar: 'دجلة المعادي' },
          fee: '25,5',
          minimum: '150',
          minutes: '40',
          shape: triangle,
        }),
        zone({ name: { en: '', ar: 'الزمالك' }, fee: '30', isOn: false }),
      ],
      centre
    )
    expect(parsed).toEqual({
      ok: true,
      value: [
        {
          id: 7,
          name: { en: 'Maadi Degla', ar: 'دجلة المعادي' },
          fee: 25.5,
          minimumOrder: 150,
          etaMinutes: 40,
          isOn: true,
          shape: [
            [30.05, 31.23],
            [30.05, 31.25],
            [30.06, 31.24],
          ],
        },
        {
          id: null,
          name: { en: null, ar: 'الزمالك' },
          fee: 30,
          minimumOrder: null,
          etaMinutes: null,
          isOn: false,
          shape: null,
        },
      ],
    })
  })

  it('takes an empty list: the branch has no named areas', () => {
    expect(parseDeliveryZones([], centre)).toEqual({ ok: true, value: [] })
  })

  it('reads empty optional fields as null, and a blank fee as free', () => {
    const parsed = parseDeliveryZones(
      [zone({ fee: ' ', minimum: '  ', minutes: '' })],
      null
    )
    expect(parsed.ok && parsed.value[0]).toMatchObject({
      fee: 0,
      minimumOrder: null,
      etaMinutes: null,
      shape: null,
    })
  })

  it('keeps a minimum of 0 apart from a blank one', () => {
    const parsed = parseDeliveryZones([zone({ minimum: '0' })], null)
    expect(parsed.ok && parsed.value[0].minimumOrder).toBe(0)
  })

  it('asks for a name in either language', () => {
    expect(
      parseDeliveryZones([zone(), zone({ name: { en: '  ', ar: '' } })], centre)
    ).toEqual({
      ok: false,
      errors: [{}, { name: 'required' }],
      tooMany: false,
    })
  })

  it('refuses a name longer than 80 characters', () => {
    const parsed = parseDeliveryZones(
      [zone({ name: { en: 'a'.repeat(81), ar: '' } })],
      centre
    )
    expect(parsed).toMatchObject({ ok: false, errors: [{ name: 'tooLong' }] })
  })

  it('refuses two areas with one name, whatever the case, in either language', () => {
    const english = parseDeliveryZones(
      [
        zone(),
        zone({ name: { en: 'Zamalek', ar: '' } }),
        zone({ name: { en: 'maadi DEGLA', ar: '' } }),
      ],
      centre
    )
    expect(english).toMatchObject({
      ok: false,
      errors: [{ name: 'duplicate' }, {}, { name: 'duplicate' }],
    })

    const arabic = parseDeliveryZones(
      [
        zone({ name: { en: 'Zamalek', ar: 'الزمالك' } }),
        zone({ name: { en: 'Zamalek North', ar: ' الزمالك ' } }),
      ],
      centre
    )
    expect(arabic).toMatchObject({
      ok: false,
      errors: [{ name: 'duplicate' }, { name: 'duplicate' }],
    })
  })

  it('does not call an area a duplicate of itself', () => {
    expect(
      parseDeliveryZones([zone({ name: { en: 'Maadi', ar: 'Maadi' } })], centre)
        .ok
    ).toBe(true)
  })

  it('refuses a negative fee or minimum, and anything that is not a number', () => {
    expect(
      parseDeliveryZones(
        [
          zone({ fee: '-5' }),
          zone({ name: { en: 'Zamalek', ar: '' }, fee: 'abc', minimum: '-1' }),
        ],
        centre
      )
    ).toMatchObject({
      ok: false,
      errors: [{ fee: true }, { fee: true, minimum: true }],
    })
  })

  it('holds the minutes to whole numbers from 5 to 240', () => {
    const minutes = (value: string) =>
      parseDeliveryZones([zone({ minutes: value })], centre)
    expect(minutes('4')).toMatchObject({
      ok: false,
      errors: [{ minutes: true }],
    })
    expect(minutes('241')).toMatchObject({
      ok: false,
      errors: [{ minutes: true }],
    })
    expect(minutes('12.5')).toMatchObject({
      ok: false,
      errors: [{ minutes: true }],
    })
    expect(minutes('5').ok).toBe(true)
    expect(minutes('240').ok).toBe(true)
  })

  it("holds a shape to the rules of the branch's own drawn area", () => {
    const far = triangle.map((p) => ({ lat: p.lat + 2, lng: p.lng }))
    expect(parseDeliveryZones([zone({ shape: far })], centre)).toMatchObject({
      ok: false,
      errors: [{ shape: 'tooFar' }],
    })
    expect(
      parseDeliveryZones([zone({ shape: triangle.slice(0, 2) })], centre)
    ).toMatchObject({ ok: false, errors: [{ shape: 'tooFew' }] })
    // A branch that is not on the map cannot keep a shape
    expect(parseDeliveryZones([zone({ shape: triangle })], null)).toMatchObject(
      { ok: false, errors: [{ shape: 'needsLocation' }] }
    )
  })

  it('takes up to 100 areas', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        zone({ name: { en: `Area ${i}`, ar: '' } })
      )
    expect(parseDeliveryZones(many(100), centre).ok).toBe(true)
    expect(parseDeliveryZones(many(101), centre)).toMatchObject({
      ok: false,
      tooMany: true,
    })
  })
})
