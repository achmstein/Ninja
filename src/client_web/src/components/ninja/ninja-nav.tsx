import { useRef, type ComponentType } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatClock, useSecondTick } from '@/lib/clock'
import { blurSwap } from '@/lib/motion'
import { useVisitTab, type VisitLive } from '@/lib/visit'
import { isTabActive, NAV_TABS } from '@/components/nav-tabs'
import { DOCK_INSET, DOCK_SIDE } from './chrome'
import { LiquidPill } from './liquid-pill'
import { Odometer } from './odometer'
import { useLiquidEdges } from './use-liquid'

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
              {isVisit && visitTab.live ? (
                <LiveVisit live={visitTab.live} icon={Icon} label={visitTab.label} />
              ) : (
                <>
                  <Icon className='size-[18px] shrink-0' />
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
  return (
    // The menu's dock's own margins, so the bar does not shift when the page changes
    <div
      className='pointer-events-none fixed inset-x-0 z-40 mx-auto max-w-lg md:hidden'
      style={{ paddingInline: DOCK_SIDE, bottom: `max(${DOCK_INSET}px, env(safe-area-inset-bottom))` }}
    >
      <div className='bg-foreground text-background pointer-events-auto rounded-[1.75rem] shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)]'>
        <NinjaNav />
      </div>
    </div>
  )
}

const RING = 26
const RING_R = 11

/**
 * The visit tab while something is on: a held place counts down to when
 * the hold lapses, its ring draining round the icon (red in the last two
 * minutes); a running clock counts up, a live dot on the icon. The digits
 * roll like the tray's total, and moving from hold to clock swaps with a
 * short blur. The place's name stays as the tab's accessible name.
 */
function LiveVisit({ live, icon: Icon, label }: { live: VisitLive; icon: ComponentType<{ className?: string }>; label: string }) {
  const reduced = useReducedMotion()
  const now = useSecondTick()
  const swap = blurSwap(reduced)
  const left = live.kind === 'hold' && live.until != null ? Math.max(0, (live.until - now) / 1000) : null
  const share =
    live.kind === 'hold' && live.until != null && live.made > 0
      ? Math.max(0, Math.min(1, (live.until - now) / Math.max(1, live.until - live.made)))
      : 1
  const hurry = left != null && left <= 120
  const clock = live.kind === 'stay' ? formatClock((now - live.since) / 1000) : left != null ? formatClock(left) : null

  return (
    <AnimatePresence mode='popLayout' initial={false}>
      <motion.span key={live.kind} {...swap} className='flex min-w-0 items-center gap-1.5' aria-label={label}>
        <span className='relative grid shrink-0 place-items-center' style={{ width: RING, height: RING }}>
          {live.kind === 'hold' ? (
            <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className='absolute inset-0 -rotate-90 rtl:scale-x-[-1]' aria-hidden>
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
                transition={{ duration: 1, ease: 'linear' }}
              />
            </svg>
          ) : (
            <span className='absolute -end-0.5 -top-0.5 grid size-2 place-items-center'>
              <span className='absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none' />
              <span className='size-1.5 rounded-full bg-emerald-400' />
            </span>
          )}
          <Icon className='size-[14px]' />
        </span>
        {clock ? (
          <Odometer value={clock} className={hurry ? 'text-red-400' : undefined} />
        ) : (
          <span className='truncate'>{label}</span>
        )}
      </motion.span>
    </AnimatePresence>
  )
}
