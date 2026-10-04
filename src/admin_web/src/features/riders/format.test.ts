import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  addressLine,
  cashDifferenceTone,
  compareRiders,
  isOpenForRider,
  num,
  presenceOf,
  stageLabel,
  stageTone,
  windowTooWide,
} from './format'

describe('riders format', () => {
  it('reads an unknown status as off', () => {
    expect(presenceOf('Online')).toBe('Online')
    expect(presenceOf('Quiet')).toBe('Quiet')
    expect(presenceOf('Off')).toBe('Off')
    expect(presenceOf(undefined)).toBe('Off')
    expect(presenceOf('Something')).toBe('Off')
  })

  it('sorts online first, then the busiest, then the latest heard, then by name', () => {
    const riders = [
      { name: 'Zed', status: 'Off', out: 0 },
      { name: 'Quiet', status: 'Quiet', out: 3 },
      { name: 'Busy', status: 'Online', out: '2' },
      {
        name: 'Idle',
        status: 'Online',
        out: 0,
        lastSeenAt: '2026-10-04T10:00:00Z',
      },
      {
        name: 'Fresh',
        status: 'Online',
        out: 0,
        lastSeenAt: '2026-10-04T11:00:00Z',
      },
      { name: 'Amr', status: 'Off', out: 0 },
    ]
    expect([...riders].sort(compareRiders).map((r) => r.name)).toEqual([
      'Busy',
      'Fresh',
      'Idle',
      'Quiet',
      'Amr',
      'Zed',
    ])
  })

  it('names and colours each stage, and how a delivery left a rider', () => {
    expect(stageLabel('Delivered')).toBe('riderStageDelivered')
    expect(stageLabel('GivenToOther')).toBe('riderStageGivenToOther')
    expect(stageLabel('nonsense')).toBe('riderStageAssigned')
    expect(stageTone('Delivered')).toBe('success')
    expect(stageTone('Failed')).toBe('danger')
    expect(stageTone('TakenBack')).toBe('muted')
  })

  it('keeps only what is still with the rider and unfinished in Now', () => {
    expect(isOpenForRider({ stage: 'Assigned', stillWithRider: true })).toBe(
      true
    )
    expect(isOpenForRider({ stage: 'OnTheWay', stillWithRider: true })).toBe(
      true
    )
    expect(isOpenForRider({ stage: 'Failed', stillWithRider: true })).toBe(true)
    expect(isOpenForRider({ stage: 'Delivered', stillWithRider: true })).toBe(
      false
    )
    expect(
      isOpenForRider({ stage: 'GivenToOther', stillWithRider: false })
    ).toBe(false)
  })

  it('names each step of a timeline', () => {
    expect(actionLabel('CashIn')).toBe('riderStepCashIn')
    expect(actionLabel('Reassigned')).toBe('riderStepReassigned')
    expect(actionLabel(undefined)).toBe('riderStepAssigned')
  })

  it('joins the address parts that are there', () => {
    expect(
      addressLine({
        address: 'Tahrir St',
        building: '12',
        floor: ' ',
        apartment: '4',
      })
    ).toBe('Tahrir St, 12, 4')
    expect(addressLine({})).toBe('')
  })

  it('says whether cash came in short, over or even', () => {
    expect(cashDifferenceTone(-10)).toBe('short')
    expect(cashDifferenceTone('5.5')).toBe('over')
    expect(cashDifferenceTone(0)).toBe('even')
    expect(cashDifferenceTone(null)).toBeNull()
  })

  it('refuses a window wider than the history takes', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    expect(windowTooWide(from, new Date('2026-04-03T00:00:00Z'))).toBe(false)
    expect(windowTooWide(from, new Date('2026-04-05T00:00:00Z'))).toBe(true)
    expect(windowTooWide(null, new Date())).toBe(false)
  })

  it('reads the client numbers whether number or string', () => {
    expect(num('12.5')).toBe(12.5)
    expect(num(undefined)).toBe(0)
    expect(num('x')).toBe(0)
  })
})
