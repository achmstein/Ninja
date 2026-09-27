import { useEffect, useRef, type ComponentType } from 'react'
import { motion } from 'motion/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatClock, useSecondTick } from '@/lib/clock'
import { ease, spring } from '@/lib/motion'
import { useVisitTab, type VisitLive } from '@/lib/visit'
import { isTabActive, NAV_TABS } from '@/components/nav-tabs'
import { DOCK_H, DOCK_INSET, DOCK_SIDE, TAB_PILL_H, TABS_H } from './chrome'
import { DockBill } from './dock-bill'
import { useLiveBills } from '@/lib/live-bills'
import { useDockRowShown } from './use-dock-row'
import { LiquidPill } from './liquid-pill'
import { Odometer } from './odometer'
import { useLiquidEdges } from './use-liquid'
import { useTuck, useTuckOnScroll } from './use-tuck'

/**
 * The app's tabs as the Ninja style draws them: a row inside the dark dock, the
 * active tab lifted by the same liquid pill as the categories. On the menu
 * it sits under the tray, one slab with it; on every other tab it is the
 * whole dock (NinjaNavDock).
 */
export function NinjaNav({ className }: { className?: string }) {
  const t = useT()
  const visitTab = useVisitTab()
  const pathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname })
  // No places to book, no tab: the chip is the table's door
  const tabs = NAV_TABS.filter((tab) => tab.key !== 'rooms' || visitTab.visible)
  const active = Math.max(0, tabs.findIndex((tab) => isTabActive(tab, pathname)))
  const row = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLAnchorElement | null>>([])
  const edges = useLiquidEdges(active, items, row, tabs.map((tab) => tab.key).join(), 'app-tabs')

  return (
    <nav className={className}>
      <div ref={row} className='relative flex items-stretch px-1.5' style={{ height: TABS_H }}>
        <LiquidPill edges={edges} height={TAB_PILL_H} top={(TABS_H - TAB_PILL_H) / 2} className='bg-[color-mix(in_oklab,var(--background)_16%,var(--foreground))]' />
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
              {isVisit && visitTab.live ? (
                <LiveVisit live={visitTab.live} icon={Icon} label={visitTab.label} />
              ) : (
                <>
                  {/* The tab arrived at lifts its icon a touch as the pill slides under it */}
                  <motion.span
                    className='grid shrink-0 place-items-center'
                    initial={false}
                    animate={on ? { y: -1, scale: 1.12 } : { y: 0, scale: 1 }}
                    transition={spring}
                  >
                    <Icon className='size-[18px]' />
                  </motion.span>
                  {/* A place's name can be long; the tab keeps its width */}
                  <span className='truncate'>{isVisit ? visitTab.label : t(tab.key)}</span>
                </>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * The bottom bar on every tab but the menu when the café wears the Ninja style:
 * the same dark slab, floating off the edges and lifted clear of the
 * phone's home indicator.
 */
export function NinjaNavDock() {
  const live = useDockRowShown(useLiveBills())
  const pathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname })
  // Every page scrolls the window; a new page starts with the dock whole
  useTuckOnScroll(null)
  useEffect(() => useTuck.setState({ tucked: false }), [pathname])
  const tucked = useTuck((s) => s.tucked)
  // With no row to keep, tucking the tabs is the whole dock going, down past the screen's edge
  const gone = tucked && !live
  return (
    // The menu's dock's own margins, so the bar does not shift when the page changes
    <div
      className='pointer-events-none fixed inset-x-0 z-40 mx-auto max-w-lg transition-transform duration-300 ease-out motion-reduce:transition-none'
      style={{
        paddingInline: DOCK_SIDE,
        bottom: `max(${DOCK_INSET}px, env(safe-area-inset-bottom))`,
        transform: gone ? `translateY(calc(100% + max(${DOCK_INSET}px, env(safe-area-inset-bottom))))` : undefined,
      }}
    >
      <div className='slab pointer-events-auto relative rounded-[1.75rem] shadow-(--slab-shadow)' inert={gone || undefined}>
        {/* The bill and the order on its way, above the tabs, on every tab */}
        <DockRow />
        <TuckedTabs tucked={tucked && live} className={live ? 'border-background/10 border-t' : undefined} />
      </div>
    </div>
  )
}

/** The tabs, folding shut under the dock's row while the customer scrolls down, and open again on the way back up */
export function TuckedTabs({ tucked, className }: { tucked: boolean; className?: string }) {
  return (
    <div
      className='overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none'
      style={{ height: tucked ? 0 : TABS_H }}
      inert={tucked || undefined}
    >
      <NinjaNav className={className} />
    </div>
  )
}

const RING = 26
const RING_R = 11

/**
 * The visit tab while a place is held: it counts down to when the hold
 * lapses, its ring draining round the icon (red in the last two minutes),
 * the digits rolling like the tray's total. A running clock is the dock's
 * row, not the tab's. The place's name stays as the tab's accessible name.
 */
function LiveVisit({ live, icon: Icon, label }: { live: VisitLive; icon: ComponentType<{ className?: string }>; label: string }) {
  const now = useSecondTick()
  const left = live.until != null ? Math.max(0, (live.until - now) / 1000) : null
  const share = live.until != null && live.made > 0 ? Math.max(0, Math.min(1, (live.until - now) / Math.max(1, live.until - live.made))) : 1
  const hurry = left != null && left <= 120

  return (
    <span className='flex min-w-0 items-center gap-1.5' aria-label={label}>
      <span className='relative grid shrink-0 place-items-center' style={{ width: RING, height: RING }}>
        <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className='absolute inset-0 -rotate-90' aria-hidden>
          <circle cx={RING / 2} cy={RING / 2} r={RING_R} fill='none' stroke='currentColor' strokeOpacity={0.2} strokeWidth={2} />
          <motion.circle
            cx={RING / 2}
            cy={RING / 2}
            r={RING_R}
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            className={hurry ? 'text-red-400' : 'text-amber-400'}
            initial={false}
            animate={{ pathLength: Math.max(0.001, share) }}
            // A short step once a second rather than a draw on every frame
            transition={{ duration: 0.4, ease: ease.move }}
          />
        </svg>
        <Icon className='size-[14px]' />
      </span>
      {left != null ? <Odometer clock value={formatClock(left)} className={hurry ? 'text-red-400' : undefined} /> : <span className='truncate'>{label}</span>}
    </span>
  )
}

/** The bill, the order on its way and the table or room, in a row of its own above the tabs (the menu puts it in the tray's row instead) */
function DockRow() {
  const bills = useLiveBills()
  const shown = useDockRowShown(bills)
  return (
    <div className='relative transition-[height] duration-300' style={{ height: shown ? DOCK_H : 0 }}>
      <DockBill live={bills} trayEmpty />
    </div>
  )
}
