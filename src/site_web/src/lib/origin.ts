/**
 * Where a visitor came from: a campaign's tags on the address (utm_source,
 * utm_medium, utm_campaign), the business that sent them (?ref=its-name, as
 * the "Powered by ninja" line in every guest app links), the site before
 * ours, and the page they landed on. Read on the first page of a visit and
 * kept for the visit, so it is still known when they ask for a demo.
 */
export type Origin = {
  source?: string
  medium?: string
  campaign?: string
  ref?: string
  referrer?: string
  landing?: string
}

const KEY = 'ninja-origin'

/** The origin a first page view says, from its address and the page before it. */
export function readOrigin(search: string, referrer: string, host: string, path: string): Origin {
  const params = new URLSearchParams(search)
  const tag = (name: string) => params.get(name)?.trim().slice(0, 60) || undefined
  let from: string | undefined
  try {
    const before = referrer ? new URL(referrer).host : ''
    // Our own pages are not where anyone came from
    if (before && before !== host) from = before.slice(0, 120)
  } catch {
    from = undefined
  }
  const origin: Origin = {
    source: tag('utm_source'),
    medium: tag('utm_medium'),
    campaign: tag('utm_campaign'),
    ref: tag('ref')?.toLowerCase().slice(0, 24),
    referrer: from,
    landing: path.slice(0, 120),
  }
  return Object.fromEntries(Object.entries(origin).filter(([, v]) => v)) as Origin
}

/** Whether an origin says more than which page was opened. */
const telling = (o: Origin) => Boolean(o.source || o.medium || o.campaign || o.ref || o.referrer)

/** This visit's origin: what the first page said, unless a later one arrives with tags of its own. */
export function origin(): Origin {
  if (typeof window === 'undefined') return {}
  const now = readOrigin(window.location.search, document.referrer, window.location.host, window.location.pathname)
  try {
    const kept = window.sessionStorage.getItem(KEY)
    const first = kept ? (JSON.parse(kept) as Origin) : null
    if (first && !(now.source || now.ref)) return first
    if (!first || telling(now)) window.sessionStorage.setItem(KEY, JSON.stringify(now))
  } catch {
    // A browser that keeps nothing: this page's own address is all there is
  }
  return now
}

/** A few words for the end of a WhatsApp message, so a chat says where it came from too; empty when nothing is known. */
export function originNote(o: Origin): string {
  const said = [o.ref, o.source, o.campaign].filter(Boolean)
  return said.length === 0 ? '' : ` (${said.join(', ')})`
}
