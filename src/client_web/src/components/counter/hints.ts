/**
 * The Counter's gestures are shown once each: a first-visit cue, then never
 * again on this browser. What has been shown is kept in localStorage; when
 * storage is missing or refuses (a private window, blocked site data), the
 * page's own memory stands in, so a cue shows at most once per session.
 */
export const HINT_KEYS = ['swipe', 'zoom', 'holdAdd', 'tray'] as const
export type HintKey = (typeof HINT_KEYS)[number]

export const HINTS_STORAGE_KEY = 'ninja-counter-hints'

export type HintStorage = Pick<Storage, 'getItem' | 'setItem'>

export type HintBook = {
  seen: (key: HintKey) => boolean
  markSeen: (key: HintKey) => void
}

export function createHintBook(storage: HintStorage | null, session: Set<string> = new Set()): HintBook {
  const read = (): string[] => {
    try {
      const raw = storage?.getItem(HINTS_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
    } catch {
      return []
    }
  }
  return {
    seen: (key) => session.has(key) || read().includes(key),
    markSeen: (key) => {
      session.add(key)
      try {
        const keys = new Set(read())
        keys.add(key)
        storage?.setItem(HINTS_STORAGE_KEY, JSON.stringify([...keys]))
      } catch {
        // The session's memory already has it
      }
    },
  }
}

/** The browser's storage, or null where even asking for it throws. */
export function browserStorage(): HintStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const sessionSeen = new Set<string>()

/** The book the page uses: the browser's storage, and this session's memory behind it. */
export const hintBook: HintBook = createHintBook(browserStorage(), sessionSeen)
