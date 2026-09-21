import { describe, expect, it } from 'vitest'
import { duration, megabytes, percent } from './format'

describe('format', () => {
  it('megabytes read as people read them', () => {
    expect(megabytes(0)).toBe('0 MB')
    expect(megabytes(512)).toBe('512 MB')
    expect(megabytes(1536)).toBe('1.5 GB')
    expect(megabytes(120 * 1024)).toBe('120 GB')
    expect(megabytes(null)).toBe('0 MB')
  })

  it('a share is a whole percentage that never passes 100', () => {
    expect(percent(1, 4)).toBe(25)
    expect(percent(5, 4)).toBe(100)
    expect(percent(1, 0)).toBe(0)
    expect(percent(1, 3)).toBe(33)
  })

  it('a span reads in seconds, minutes or hours, and until now when open', () => {
    const start = '2026-09-22T10:00:00Z'
    expect(duration(start, '2026-09-22T10:00:03Z')).toBe('3s')
    expect(duration(start, '2026-09-22T10:01:12Z')).toBe('1m 12s')
    expect(duration(start, '2026-09-22T12:05:00Z')).toBe('2h 05m')
    expect(duration(start, null, Date.parse('2026-09-22T10:00:45Z'))).toBe('45s')
    expect(duration(null, null)).toBe('')
    expect(duration('2026-09-22T10:00:10Z', start)).toBe('0s')
  })
})
