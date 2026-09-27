import { describe, expect, it } from 'vitest'
import { tuckAt } from './use-tuck'

const MAX = 2000

describe('tuckAt', () => {
  it('keeps the dock whole near the top', () => {
    expect(tuckAt(40, MAX, 0, false).tucked).toBe(false)
    expect(tuckAt(30, MAX, 200, true).tucked).toBe(false)
  })

  it('tucks once a scroll down runs past the slack', () => {
    expect(tuckAt(305, MAX, 300, false)).toEqual({ tucked: false, from: 300 })
    expect(tuckAt(320, MAX, 300, false)).toEqual({ tucked: true, from: 320 })
  })

  it('untucks once a scroll up runs past the slack', () => {
    expect(tuckAt(595, MAX, 600, true)).toEqual({ tucked: true, from: 600 })
    expect(tuckAt(580, MAX, 600, true)).toEqual({ tucked: false, from: 580 })
  })

  it('moves the anchor along with a scroll the dock agrees with', () => {
    expect(tuckAt(900, MAX, 600, true)).toEqual({ tucked: true, from: 900 })
    expect(tuckAt(500, MAX, 600, false)).toEqual({ tucked: false, from: 500 })
  })

  it('brings the dock back at the end of the page', () => {
    expect(tuckAt(MAX, MAX, 1900, true).tucked).toBe(false)
  })
})
