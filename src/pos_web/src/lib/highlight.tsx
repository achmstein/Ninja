import { Fragment } from 'react'

/**
 * Where a customer's name matches what the cashier typed, so the eye lands
 * on the right Ahmed. Mirrors the server's matching closely enough to mark
 * the same letters: case and Arabic letter variants are ignored, hyphens
 * read as spaces, every typed word marks the start of a word of the name
 * or of the name run together ("elhady" marks "El Hady"), and digits mark
 * the phone number. A typo the server tolerated marks nothing — the row is
 * still there, just not underlined.
 */

// Same length in and out, so ranges found here index the original text
function normalizeChar(ch: string): string {
  switch (ch) {
    case 'أ':
    case 'إ':
    case 'آ':
    case 'ٱ':
      return 'ا'
    case 'ة':
      return 'ه'
    case 'ى':
    case 'ئ':
      return 'ي'
    case 'ؤ':
      return 'و'
    case '-':
    case '_':
      return ' '
    default:
      return ch.toLowerCase()
  }
}

function normalize(text: string): string {
  return Array.from(text, normalizeChar).join('')
}

export type Range = [start: number, end: number]

/**
 * The [start, end) ranges of `text` to mark for `term`. Each typed word is
 * walked from every word boundary of the text, skipping the text's spaces,
 * so a word matches either a word prefix or the run-together name.
 */
export function matchRanges(text: string, term: string): Range[] {
  const source = normalize(text)
  const words = normalize(term)
    .split(' ')
    .map((w) => w.replace(/['’.]/g, ''))
    .filter((w) => w.length > 0)
  if (words.length === 0 || source.length === 0) return []

  const ranges: Range[] = []
  for (const word of words) {
    for (let start = 0; start < source.length; start++) {
      if (start > 0 && source[start - 1] !== ' ') continue
      if (source[start] === ' ') continue
      let j = start
      let k = 0
      while (k < word.length && j < source.length) {
        if (source[j] === ' ') {
          j++
          continue
        }
        if (source[j] !== word[k]) break
        j++
        k++
      }
      if (k === word.length) ranges.push([start, j])
    }
  }
  return mergeRanges(ranges)
}

/** The digits of `term` inside `phone`, skipping the phone's own spacing. */
export function phoneRanges(phone: string, term: string): Range[] {
  const digits = term.replace(/\D/g, '')
  if (digits.length < 2) return []
  const ranges: Range[] = []
  for (let start = 0; start < phone.length; start++) {
    if (!/\d/.test(phone[start])) continue
    let j = start
    let k = 0
    while (k < digits.length && j < phone.length) {
      if (!/\d/.test(phone[j])) {
        j++
        continue
      }
      if (phone[j] !== digits[k]) break
      j++
      k++
    }
    if (k === digits.length) {
      ranges.push([start, j])
      break
    }
  }
  return ranges
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: Range[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1])
    } else {
      merged.push([range[0], range[1]])
    }
  }
  return merged
}

/** `text` with the matched parts wrapped in `<mark>`. */
export function Highlight({
  text,
  ranges,
}: {
  text: string
  ranges: Range[]
}) {
  if (ranges.length === 0) return <>{text}</>
  const parts = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>)
    parts.push(
      <mark
        key={`m${start}`}
        className='rounded-sm bg-primary/15 px-0.5 font-semibold text-inherit'
      >
        {text.slice(start, end)}
      </mark>
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>)
  return <>{parts}</>
}
