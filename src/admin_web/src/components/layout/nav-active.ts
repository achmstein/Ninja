import { type TranslationKey } from '@/lib/i18n'
import { type NavItem } from './types'

/**
 * Whether a sidebar entry is the one the current page belongs to. Exactly
 * one entry per group should light up, which is what `groupUrls` is for:
 * it lets a prefix match step aside for a sibling that matches more of the
 * path.
 */
export function checkIsActive(
  href: string,
  item: NavItem,
  mainNav = false,
  groupUrls: string[] = []
) {
  const path = href.split('?')[0]
  return (
    href === item.url || // /endpint?search=param
    path === item.url || // endpoint
    !!item?.items?.filter((i) => i.url === href).length || // if child nav is active
    // child pages without their own nav item (e.g. /places/history → Rooms),
    // unless a *more specific* sibling claims the path (e.g. under
    // /orders/live, Live wins over Orders). Only a longer url
    // may cancel this one: a shorter one is the parent of both and would
    // otherwise leave neither entry active.
    (typeof item.url === 'string' &&
      item.url !== '/' &&
      path.startsWith(`${item.url}/`) &&
      !groupUrls.some(
        (url) =>
          url.length > (item.url as string).length &&
          (path === url || path.startsWith(`${url}/`))
      )) ||
    // a collapsible section is active when any page under its first segment is
    (mainNav &&
      !!item.items &&
      item.items.some((sub) => {
        const subPath = String(sub.url)
        return path === subPath || path.startsWith(`${subPath}/`)
      })) ||
    (mainNav &&
      href.split('/')[1] !== '' &&
      href.split('/')[1] === item?.url?.split('/')[1]) ||
    // the entry's other tabs, and paths given to it (Attendance → Employees)
    otherPaths(item).some((url) => path === url || path.startsWith(`${url}/`))
  )
}

/** Paths beyond its own url that belong to an entry: its tabs, its `match` */
function otherPaths(item: NavItem): string[] {
  if (item.items) return []
  return [
    ...(item.tabs ?? []).map((tab) => String(tab.url)),
    ...(item.match ?? []),
  ]
}

/**
 * Where a path sits in the navigation, for the top bar's breadcrumbs: the
 * group's title and the page's, both translation keys. The entry with the
 * longest url (its own, a tab's or a `match`) the path is under wins
 * (/inventory/history/counts is Stock, through its History tab); the
 * dashboard only for "/".
 */
export function navTrail(
  pathname: string,
  groups: { title: TranslationKey; items: NavItem[] }[]
): { group: TranslationKey | null; page: TranslationKey } | null {
  let best: {
    group: TranslationKey
    page: TranslationKey
    length: number
  } | null = null
  for (const group of groups) {
    const entries = group.items.flatMap((item) =>
      item.items ? item.items : [item]
    )
    for (const entry of entries) {
      const own = typeof entry.url === 'string' ? entry.url : null
      if (!own) continue
      for (const url of [own, ...otherPaths(entry as NavItem)]) {
        const matches =
          url === '/'
            ? pathname === '/'
            : pathname === url || pathname.startsWith(`${url}/`)
        if (matches && (!best || url.length > best.length)) {
          best = { group: group.title, page: entry.title, length: url.length }
        }
      }
    }
  }
  return best ? { group: best.group, page: best.page } : null
}
