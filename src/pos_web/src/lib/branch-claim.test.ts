import { describe, expect, it } from 'vitest'
import { readBranchClaim } from './branch-claim'

describe('readBranchClaim', () => {
  it('reads a list of ids', () => {
    expect(readBranchClaim(['1', '3'])).toEqual({ all: false, ids: [1, 3] })
  })

  it('reads a single value', () => {
    expect(readBranchClaim('2')).toEqual({ all: false, ids: [2] })
  })

  it('is no branch without the claim', () => {
    expect(readBranchClaim(undefined)).toEqual({ all: false, ids: [] })
  })

  it('takes a star as every branch, whatever sits beside it', () => {
    expect(readBranchClaim(['*'])).toEqual({ all: true, ids: [] })
    expect(readBranchClaim('*')).toEqual({ all: true, ids: [] })
    expect(readBranchClaim(['2', '*'])).toEqual({ all: true, ids: [] })
  })

  it('drops values that are not ids', () => {
    expect(readBranchClaim(['x', '4'])).toEqual({ all: false, ids: [4] })
  })
})
