import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { GalleryVertical, LayoutGrid } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LiquidPill } from './liquid-pill'
import { useLiquidEdges } from './use-liquid'

const PILL_H = 36

/**
 * The categories above the dock, in the thumb's reach. The active one sits
 * in a pill whose two edges move on different springs. Tapping the active
 * category again, or the whole-menu button, zooms out to the whole menu.
 * On the whole menu (`zoomed`) the same row is a jump bar: a tap scrolls to
 * that category, the pill follows the one in view, and the button at the
 * end goes back to the cards.
 */
export function LiquidTabs({
  labels,
  active,
  onSelect,
  onZoomOut,
  zoomed = false,
}: {
  labels: string[]
  active: number
  onSelect: (index: number) => void
  /** The button at the end: to the whole menu, or (zoomed) back to the cards */
  onZoomOut: () => void
  zoomed?: boolean
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const row = useRef<HTMLDivElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const edges = useLiquidEdges(active, tabs, row)
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  // scrollLeft runs negative in a right-to-left row, so its size is what counts
  const measureMore = () => {
    const el = scroller.current
    if (el) setMore(Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 2)
  }
  useLayoutEffect(measureMore, [labels.length])

  useLayoutEffect(() => {
    tabs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }, [active, reduced])

  return (
    <div className='flex items-center gap-1 ps-2 pe-1'>
      {/* While more categories wait past the end, the row fades out before the
          whole-menu button rather than running under it; at the end it does
          not, so the last category's pill is never washed out */}
      <div
        ref={scroller}
        onScroll={measureMore}
        className={cn(
          'no-scrollbar min-w-0 flex-1 overflow-x-auto',
          more &&
            '[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-28px),transparent)]'
        )}
      >
        <div ref={row} role='tablist' className='relative flex w-max items-center py-1'>
          <LiquidPill edges={edges} height={PILL_H} top={4} className='bg-primary' />
          {labels.map((label, i) => (
            <button
              key={`${i}-${label}`}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type='button'
              role='tab'
              aria-selected={i === active}
              onClick={() => (i === active && !zoomed ? onZoomOut() : onSelect(i))}
              className={cn(
                'relative z-10 h-9 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
                i === active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <button
        type='button'
        onClick={onZoomOut}
        aria-label={t(zoomed ? 'ninjaBackToCards' : 'ninjaWholeMenu')}
        data-hint-anchor={zoomed ? undefined : 'zoom'}
        className='bg-muted text-foreground grid size-9 shrink-0 place-items-center rounded-full'
      >
        {zoomed ? <GalleryVertical className='size-4' /> : <LayoutGrid className='size-4' />}
      </button>
    </div>
  )
}
