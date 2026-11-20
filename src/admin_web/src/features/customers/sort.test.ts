import { describe, expect, it } from 'vitest'
import { sortRows, type CustomerRow } from './sort'

const row = (name: string, over: Partial<CustomerRow> = {}): CustomerRow => ({
  id: name,
  name,
  orderCount: 0,
  spent: 0,
  balance: 0,
  member: false,
  points: 0,
  ...over,
})

const names = (rows: CustomerRow[]) => rows.map((r) => r.name)

describe('sortRows', () => {
  const rows = [
    row('Mona', {
      lastOrderAt: '2026-11-01T10:00:00Z',
      spent: 300,
      orderCount: 3,
    }),
    row('ahmed', { balance: 120, member: true, points: 0 }),
    row('Karim', {
      lastOrderAt: '2026-11-19T10:00:00Z',
      spent: 90,
      orderCount: 1,
      member: true,
      points: 340,
    }),
    row('Zeina', { balance: -50 }),
  ]

  it('puts the latest order first and those who never ordered last, by name', () => {
    expect(names(sortRows(rows, 'lastOrder'))).toEqual([
      'Karim',
      'Mona',
      'ahmed',
      'Zeina',
    ])
  })

  it('sorts by what was spent, most first', () => {
    expect(names(sortRows(rows, 'spent'))).toEqual([
      'Mona',
      'Karim',
      'ahmed',
      'Zeina',
    ])
  })

  it('counts a credit as owing nothing', () => {
    expect(names(sortRows(rows, 'owes'))).toEqual([
      'ahmed',
      'Karim',
      'Mona',
      'Zeina',
    ])
  })

  it('puts members before non-members, even a member with no points', () => {
    expect(names(sortRows(rows, 'points'))).toEqual([
      'Karim',
      'ahmed',
      'Mona',
      'Zeina',
    ])
  })

  it('sorts names without minding their case, and leaves the list given untouched', () => {
    expect(names(sortRows(rows, 'name'))).toEqual([
      'ahmed',
      'Karim',
      'Mona',
      'Zeina',
    ])
    expect(names(rows)).toEqual(['Mona', 'ahmed', 'Karim', 'Zeina'])
  })
})
