import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { LayoutGrid } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LiquidPill } from './liquid-pill'
import { useLiquidEdges } from './use-liquid'

const PILL_H = 36

/**
 * The categories above the dock, in the thumb's reach. The active one sits
 * in a pill whose two edges move on different springs. Tapping the active
 * category again, or the whole-menu button, zooms out to the whole menu.
 */
export function LiquidTabs({
  labels,
  active,
  onSelect,
  onZoomOut,
}: {
  labels: string[]
  active: number
  onSelect: (index: number) => void
  onZoomOut: () => void
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const row = useRef<HTMLDivElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const edges = useLiquidEdges(active, tabs, row)

  useLayoutEffect(() => {
    tabs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }, [active, reduced])

  return (
    <div className='flex items-center gap-1 ps-2 pe-1'>
      <div className='no-scrollbar min-w-0 flex-1 overflow-x-auto'>
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
              onClick={() => (i === active ? onZoomOut() : onSelect(i))}
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
        aria-label={t('counterWholeMenu')}
        data-hint-anchor='zoom'
        className='bg-muted text-foreground grid size-9 shrink-0 place-items-center rounded-full'
      >
        <LayoutGrid className='size-4' />
      </button>
    </div>
  )
}
