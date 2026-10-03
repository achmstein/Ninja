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
    // child pages without their own nav item (e.g. /rooms/history → Rooms),
    // unless a *more specific* sibling claims the path (e.g. under
    // /inventory/history/counts, History wins over Stock). Only a longer url
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
      href.split('/')[1] === item?.url?.split('/')[1])
  )
}

/**
 * Where a path sits in the navigation, for the top bar's breadcrumbs: the
 * group's title and the page's, both translation keys. The entry with the
 * longest url the path is under wins (/inventory/history/counts is History,
 * not Stock); the dashboard only for "/".
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
      const url = typeof entry.url === 'string' ? entry.url : null
      if (!url) continue
      const matches =
        url === '/'
          ? pathname === '/'
          : pathname === url || pathname.startsWith(`${url}/`)
      if (matches && (!best || url.length > best.length)) {
        best = { group: group.title, page: entry.title, length: url.length }
      }
    }
  }
  return best ? { group: best.group, page: best.page } : null
}
