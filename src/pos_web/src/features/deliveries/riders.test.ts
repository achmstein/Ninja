import { describe, expect, it } from 'vitest'
import { mergeRiders } from './riders'

// The till's rider picker: the riders whose app has checked in at the branch,
// then those given the branch in Staff who have not opened the app yet.

describe('mergeRiders', () => {
  const heard = [{ userId: 'a', name: 'Amr', onDuty: true, lastSeenAt: '2026-10-04T10:00:00Z', out: 1 }]

  it('keeps the checked-in riders first, as Ordering ordered them', () => {
    const riders = mergeRiders(heard, [], 1)
    expect(riders).toEqual([{ ...heard[0], signedIn: true }])
  })

  it('adds the branch riders who have not opened the app yet, by name', () => {
    const riders = mergeRiders(
      heard,
      [
        { id: 'a', firstName: 'Amr', branches: [1] },
        { id: 'z', firstName: 'Ziad', lastName: 'Ali', branches: [1] },
        { id: 'm', username: 'mona@x', branches: [1, 2] },
        { id: 'o', firstName: 'Other', branches: [2] },
        { id: 'n', firstName: 'Nobranch', branches: [] },
      ],
      1,
    )
    expect(riders.map((r) => [r.userId, r.name, r.signedIn])).toEqual([
      ['a', 'Amr', true],
      ['m', 'mona@x', false],
      ['z', 'Ziad Ali', false],
    ])
    expect(riders[1]).toMatchObject({ onDuty: false, out: 0 })
  })

  it('adds nobody while the till has no branch', () => {
    expect(mergeRiders([], [{ id: 'z', firstName: 'Ziad', branches: [1] }], null)).toEqual([])
  })
})
