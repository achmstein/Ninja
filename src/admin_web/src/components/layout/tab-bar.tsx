import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Radio,
  LayoutDashboard,
  Menu as MenuIcon,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'
import { ActiveMarker } from '@/components/motion'

type Tab = {
  to: '/' | '/orders/live' | '/till' | '/menu'
  label: TranslationKey
  icon: LucideIcon
}

/** The places an owner goes every day; the rest is behind More */
const TABS: Tab[] = [
  { to: '/', label: 'overview', icon: LayoutDashboard },
  { to: '/orders/live', label: 'liveNav', icon: Radio },
  { to: '/till', label: 'navTill', icon: ReceiptText },
  { to: '/menu', label: 'menuItems', icon: BookOpen },
]

function isActive(pathname: string, to: Tab['to']) {
  if (to === '/') return pathname === '/'
  if (to === '/orders/live')
    return pathname.startsWith('/orders') || pathname.startsWith('/requests')
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * The admin on a phone: a bar at the bottom, in the thumb's reach, for the
 * four places used every day and More for the rest (the whole navigation,
 * as the sidebar's sheet). The tab you are on is marked by one shape that
 * slides to it; Orders carries how many are waiting. Hidden where the
 * sidebar is on screen.
 */
export function TabBar() {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { setOpenMobile } = useSidebar()
  const { data: pending = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })
  const onTab = TABS.some((tab) => isActive(pathname, tab.to))

  const item =
    'relative isolate flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors'

  return (
    <nav
      aria-label={t('navigation')}
      className='bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden'
    >
      <div className='mx-auto flex max-w-md items-center gap-1'>
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.to)
          const count = tab.to === '/orders/live' ? pending.length : 0
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                item,
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {active && (
                <ActiveMarker group='tab-bar' className='bg-muted rounded-xl' />
              )}
              <span className='relative'>
                <tab.icon
                  className='size-5'
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {count > 0 && (
                  <span className='bg-primary text-primary-foreground absolute -end-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums'>
                    {count}
                  </span>
                )}
              </span>
              {t(tab.label)}
            </Link>
          )
        })}
        <button
          type='button'
          onClick={() => setOpenMobile(true)}
          className={cn(
            item,
            onTab ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {!onTab && (
            <ActiveMarker group='tab-bar' className='bg-muted rounded-xl' />
          )}
          <MenuIcon className='size-5' strokeWidth={onTab ? 1.75 : 2.25} />
          {t('more')}
        </button>
      </div>
    </nav>
  )
}
