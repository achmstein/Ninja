import { useRef } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useVisitTab } from '@/lib/visit'
import { isTabActive, NAV_TABS } from '@/components/nav-tabs'
import { LiquidPill } from './liquid-pill'
import { useLiquidEdges } from './use-liquid'

/**
 * The app's tabs as the Counter draws them: a row inside the dark dock, the
 * active tab lifted by the same liquid pill as the categories. On the menu
 * it sits under the tray, one slab with it; on every other tab it is the
 * whole dock (CounterNavDock).
 */
export function CounterNav({ className }: { className?: string }) {
  const t = useT()
  const visitTab = useVisitTab()
  const pathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname })
  // No places to book, no tab: the chip is the table's door
  const tabs = NAV_TABS.filter((tab) => tab.key !== 'rooms' || visitTab.visible)
  const active = Math.max(0, tabs.findIndex((tab) => isTabActive(tab, pathname)))
  const row = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLAnchorElement | null>>([])
  const edges = useLiquidEdges(active, items, row)

  return (
    <nav className={cn('md:hidden', className)}>
      <div ref={row} className='relative flex h-14 items-stretch px-1.5'>
        <LiquidPill edges={edges} height={44} top={6} className='bg-[color-mix(in_oklab,var(--background)_16%,var(--foreground))]' />
        {tabs.map((tab, i) => {
          const isVisit = tab.key === 'rooms'
          const Icon = isVisit ? visitTab.icon : tab.icon
          const on = i === active
          return (
            <Link
              key={tab.to}
              to={tab.to}
              ref={(el) => {
                items.current[i] = el
              }}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 text-xs font-semibold transition-colors duration-200',
                on ? 'text-background' : 'text-background/55'
              )}
            >
              <Icon className='size-[18px] shrink-0' />
              {/* A place's name can be long; the tab keeps its width */}
              <span className='truncate'>{isVisit ? visitTab.label : t(tab.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * The bottom bar on every tab but the menu when the café wears the Counter:
 * the same dark slab, floating off the edges and lifted clear of the
 * phone's home indicator.
 */
export function CounterNavDock() {
  return (
    <div className='pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg px-2 md:hidden'>
      <div className='bg-foreground text-background pointer-events-auto rounded-[1.75rem] shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)]'>
        <CounterNav />
      </div>
    </div>
  )
}
