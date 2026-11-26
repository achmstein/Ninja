import { describe, expect, it } from 'vitest'
import { billPeople } from './bill-people'

describe('billPeople', () => {
  it('lists the room first, then whoever earlier rounds were for, each once', () => {
    const people = billPeople(
      [{ id: 'a', name: 'Mona Ali' }],
      [
        { customerId: 'b', customerName: 'Ahmed Hassan' },
        { customerId: 'a', customerName: 'Mona Ali' },
        { customerId: null, customerName: 'Ziad' },
        { customerId: null, customerName: 'Ziad' },
        { customerId: null, customerName: null },
      ],
    )
    expect(people).toEqual([
      { id: 'a', name: 'Mona Ali' },
      { id: 'b', name: 'Ahmed Hassan' },
      { id: null, name: 'Ziad' },
    ])
  })

  it('adds the ones named since, unless the bill has them already', () => {
    const people = billPeople([], [{ customerId: 'a', customerName: 'Mona Ali' }], [
      { id: 'a', name: 'Mona Ali' },
      { id: 'c', name: 'Sara Khaled' },
    ])
    expect(people.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('keeps an account apart from a bare name that reads the same', () => {
    const people = billPeople([], [
      { customerId: 'a', customerName: 'Mona' },
      { customerId: null, customerName: 'Mona' },
    ])
    expect(people).toHaveLength(2)
  })
})
