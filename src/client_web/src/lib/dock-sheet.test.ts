import { describe, expect, it } from 'vitest'
import { dockHole, pulledLift, useDockSheet } from './dock-sheet'

describe('pulledLift', () => {
  it('stands tucked in the row until the finger pulls it up, and follows it from the first pixel', () => {
    expect(pulledLift(400, 0)).toBe(400)
    expect(pulledLift(400, -1)).toBe(399)
    expect(pulledLift(400, -150)).toBe(250)
  })

  it('stops at open above and at the row below', () => {
    expect(pulledLift(400, -600)).toBe(0)
    expect(pulledLift(400, 40)).toBe(400)
  })
})

describe('dockHole', () => {
  it('cuts the dock out of the whole screen, its corners rounded', () => {
    const path = dockHole(390, 844, { left: 8, top: 700, right: 382, bottom: 836 }, 28, 28)
    expect(path.startsWith("path(evenodd, 'M0 0H390V844H0Z")).toBe(true)
    expect(path).toContain('M36 700H354A28 28 0 0 1 382 728')
  })

  it('keeps a stuck dock square at the bottom edge', () => {
    expect(dockHole(390, 844, { left: 0, top: 744, right: 390, bottom: 844 }, 28, 0)).toContain('V844A0 0 0 0 1 390 844')
  })
})

describe('useDockSheet', () => {
  it('rises out of the row only when the row opened it, and closes the way it came', () => {
    useDockSheet.getState().openFromRow()
    expect(useDockSheet.getState()).toMatchObject({ open: true, fromRow: true })
    useDockSheet.getState().setOpen(false)
    expect(useDockSheet.getState()).toMatchObject({ open: false, fromRow: true })
    useDockSheet.getState().setOpen(true)
    expect(useDockSheet.getState()).toMatchObject({ open: true, fromRow: false })
  })
})
