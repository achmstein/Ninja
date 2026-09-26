import { describe, expect, it } from 'vitest'
import { createHintBook, HINTS_STORAGE_KEY, type HintStorage } from './hints'

function memoryStorage(initial: Record<string, string> = {}): HintStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const refusing: HintStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('hint book', () => {
  it('shows each hint until it is marked, then never on this browser', () => {
    const storage = memoryStorage()
    const book = createHintBook(storage)
    expect(book.seen('swipe')).toBe(false)
    book.markSeen('swipe')
    expect(book.seen('swipe')).toBe(true)
    expect(book.seen('zoom')).toBe(false)
    // A new page load reads the same browser storage
    expect(createHintBook(storage).seen('swipe')).toBe(true)
  })

  it('keeps every hint it marks, without repeats', () => {
    const storage = memoryStorage()
    const book = createHintBook(storage)
    book.markSeen('swipe')
    book.markSeen('tray')
    book.markSeen('swipe')
    expect(JSON.parse(storage.data[HINTS_STORAGE_KEY])).toEqual(['swipe', 'tray'])
  })

  it('falls back to the session when storage refuses: at most once per session', () => {
    const session = new Set<string>()
    const book = createHintBook(refusing, session)
    expect(book.seen('holdAdd')).toBe(false)
    book.markSeen('holdAdd')
    expect(book.seen('holdAdd')).toBe(true)
    // Another book in the same session (the page re-rendering) remembers it too
    expect(createHintBook(refusing, session).seen('holdAdd')).toBe(true)
  })

  it('works with no storage at all', () => {
    const book = createHintBook(null)
    book.markSeen('zoom')
    expect(book.seen('zoom')).toBe(true)
  })

  it('treats a stored value it cannot read as nothing seen, and repairs it', () => {
    const storage = memoryStorage({ [HINTS_STORAGE_KEY]: '{not json' })
    const book = createHintBook(storage)
    expect(book.seen('swipe')).toBe(false)
    book.markSeen('swipe')
    expect(JSON.parse(storage.data[HINTS_STORAGE_KEY])).toEqual(['swipe'])
  })

  it('ignores a stored value of the wrong shape', () => {
    expect(createHintBook(memoryStorage({ [HINTS_STORAGE_KEY]: '{"swipe":true}' })).seen('swipe')).toBe(false)
    expect(createHintBook(memoryStorage({ [HINTS_STORAGE_KEY]: '["swipe", 3]' })).seen('swipe')).toBe(true)
  })
})
