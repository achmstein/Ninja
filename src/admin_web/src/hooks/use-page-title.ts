import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useBrandName } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { sidebarData } from '@/components/layout/data/sidebar-data'

// Pages not present in the sidebar
const extraTitles: Record<string, TranslationKey> = {
  '/settings': 'settings',
  '/places/history': 'timeHistory',
  '/places/reservations': 'reservationHistory',
  '/orders/history': 'orderHistory',
}

/**
 * Keeps the browser-tab title in sync with the current page, derived from
 * the sidebar: "Orders · Chillax".
 */
export function usePageTitle() {
  const t = useT()
  const cafe = useBrandName()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    const entries: { url: string; title: TranslationKey }[] = [
      ...Object.entries(extraTitles).map(([url, title]) => ({
        url,
        title: title as TranslationKey,
      })),
      ...sidebarData.navGroups.flatMap((group) =>
        group.items.flatMap((item) =>
          item.url
            ? [{ url: String(item.url), title: item.title }]
            : (item.items ?? []).map((sub) => ({
                url: String(sub.url),
                title: sub.title,
              }))
        )
      ),
    ]

    const match = entries
      .filter(
        (entry) =>
          pathname === entry.url ||
          (entry.url !== '/' && pathname.startsWith(`${entry.url}/`))
      )
      .sort((a, b) => b.url.length - a.url.length)[0]

    const name = cafe || t('adminName')
    document.title = match ? `${t(match.title)} · ${name}` : name
  }, [pathname, t, cafe])
}
