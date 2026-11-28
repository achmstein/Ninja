import { describe, expect, it } from 'vitest'
import { dayKey, friendlyDay, friendlyTime } from './friendly-day'

const words = { today: 'Today', yesterday: 'Yesterday' }
const now = new Date(2026, 10, 28, 1, 30)

describe('friendlyDay', () => {
  it('says today and yesterday in words', () => {
    expect(friendlyDay(new Date(2026, 10, 28, 0, 5), 'en', words, now)).toBe('Today')
    expect(friendlyDay(new Date(2026, 10, 27, 23, 50), 'en', words, now)).toBe('Yesterday')
  })

  it('names an earlier day by its weekday and date, without this year', () => {
    expect(friendlyDay(new Date(2026, 10, 25, 21, 30), 'en', words, now)).toBe('Wednesday, November 25')
  })

  it('adds the year once it is another one', () => {
    expect(friendlyDay(new Date(2025, 11, 31, 21, 30), 'en', words, now)).toContain('2025')
  })

  it('counts yesterday across a month end', () => {
    expect(friendlyDay(new Date(2026, 10, 30, 22, 0), 'en', words, new Date(2026, 11, 1, 9, 0))).toBe('Yesterday')
  })
})

describe('dayKey and friendlyTime', () => {
  it('two moments of one day share a key, and midnight starts another', () => {
    expect(dayKey(new Date(2026, 10, 28, 0, 0))).toBe(dayKey(new Date(2026, 10, 28, 23, 59)))
    expect(dayKey(new Date(2026, 10, 27, 23, 59))).not.toBe(dayKey(new Date(2026, 10, 28, 0, 0)))
  })

  it('gives the time alone', () => {
    expect(friendlyTime(new Date(2026, 10, 28, 1, 25), 'en')).toMatch(/1:25/)
  })
})
