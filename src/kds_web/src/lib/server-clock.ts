/**
 * The server's clock, as read from the Date header of its answers. The
 * board's timers count from when the server confirmed an order, so a
 * kitchen screen whose own clock runs a minute behind showed a new order at
 * 0:00 for that minute, and one ahead started it at a minute. Counting
 * against the server's time instead, the clock starts as the card arrives.
 */

/** Recent readings, the server's time less this device's, ms */
const samples: number[] = []
const KEEP = 5
let offsetMs = 0

/** Takes one answer's Date header; one without (or unreadable) changes nothing. */
export function noteServerDate(header: string | null | undefined, receivedMs = Date.now()) {
  if (!header) return
  const serverMs = Date.parse(header)
  if (Number.isNaN(serverMs)) return
  // The header is whole seconds, rounded down: the server's time was within the second after it
  samples.push(serverMs + 500 - receivedMs)
  if (samples.length > KEEP) samples.shift()
  // The middle reading, so one slow answer does not move every timer
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = sorted[Math.floor(sorted.length / 2)]
  // Under a second apart is the header's own rounding, not a wrong clock
  offsetMs = Math.abs(middle) < 1_000 ? 0 : middle
}

/** Now, by the server's clock as best known; this device's until an answer has come. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

/** For tests: forget every reading. */
export function resetServerClock() {
  samples.length = 0
  offsetMs = 0
}
