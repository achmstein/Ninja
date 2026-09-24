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
