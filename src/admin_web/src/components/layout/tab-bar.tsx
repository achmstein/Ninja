import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Menu as MenuIcon,
  ReceiptText,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ActiveMarker } from '@/components/motion'
import { MoreSheet } from './more-sheet'

type Tab = {
  to: '/' | '/till' | '/inventory' | '/menu' | '/orders'
  label: TranslationKey
  icon: LucideIcon
}

/**
 * The places an owner goes every day: the overview, the till, the stock and
 * the menu (the orders where there is no stock to keep). What is live is
 * the staff's screen, behind More with its count
 */
function tabsFor(inventory: boolean): Tab[] {
  return [
    { to: '/', label: 'overview', icon: LayoutDashboard },
    { to: '/till', label: 'navTill', icon: ReceiptText },
    inventory
      ? { to: '/inventory', label: 'stock', icon: Warehouse }
      : { to: '/orders', label: 'orders', icon: ClipboardList },
    { to: '/menu', label: 'menuItems', icon: BookOpen },
  ]
}

function isActive(pathname: string, to: Tab['to']) {
  if (to === '/') return pathname === '/'
  // Orders is the list; Live (/orders/live) is its own page behind More
  if (to === '/orders') return pathname === '/orders'
  if (to === '/menu')
    return pathname.startsWith('/menu') || pathname.startsWith('/promos')
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * The admin on a phone: a bar at the bottom, in the thumb's reach, for the
 * four places used every day and More for the rest (every page, as tiles
 * rising from the bottom). The tab you are on is marked by one shape that
 * slides to it; Orders carries how many are waiting. Hidden where the
 * sidebar is on screen.
 */
export function TabBar() {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const features = useFeatures()
  const [moreOpen, setMoreOpen] = useState(false)
  const TABS = tabsFor(features.inventory)
  const { data: pending = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })
  const onTab = TABS.some((tab) => isActive(pathname, tab.to))

  const item =
    'relative isolate flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors'

  return (
    <>
      <nav
        aria-label={t('navigation')}
        className='bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden'
      >
        <div className='mx-auto flex max-w-md items-center gap-1'>
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.to)
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
                  <ActiveMarker
                    group='tab-bar'
                    className='bg-muted rounded-xl'
                  />
                )}
                <tab.icon
                  className='size-5'
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {t(tab.label)}
              </Link>
            )
          })}
          <button
            type='button'
            onClick={() => setMoreOpen(true)}
            className={cn(
              item,
              onTab ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {!onTab && (
              <ActiveMarker group='tab-bar' className='bg-muted rounded-xl' />
            )}
            {/* Live is behind More: its waiting orders show here */}
            <span className='relative'>
              <MenuIcon className='size-5' strokeWidth={onTab ? 1.75 : 2.25} />
              {pending.length > 0 && (
                <span className='bg-primary text-primary-foreground absolute -end-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums'>
                  {pending.length}
                </span>
              )}
            </span>
            {t('more')}
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
