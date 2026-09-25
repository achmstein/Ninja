import { useEffect, useRef } from 'react'
import type { CategoriesLayout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type MenuSection = {
  id: string
  label: string
}

interface CategoryRailProps {
  sections: MenuSection[]
  activeId: string
  onSelect: (id: string) => void
  /** chips (the classic rail), tabs, or a side list on wide screens */
  variant?: CategoriesLayout
}

/**
 * The categories, scroll-synced with the menu sections, as the style lays
 * them out: a sticky rail of chips or of underlined tabs, or, for "rail", a
 * list beside the menu on a wide screen (the page puts it in its own
 * column) with the chips kept for a phone.
 */
export function CategoryRail({ sections, activeId, onSelect, variant = 'chips' }: CategoryRailProps) {
  if (variant === 'rail') {
    return (
      <>
        <StickyBar sections={sections} activeId={activeId} onSelect={onSelect} tabs={false} className='md:hidden' />
        <SideList sections={sections} activeId={activeId} onSelect={onSelect} />
      </>
    )
  }
  return <StickyBar sections={sections} activeId={activeId} onSelect={onSelect} tabs={variant === 'tabs'} />
}

function StickyBar({
  sections,
  activeId,
  onSelect,
  tabs,
  className,
}: Omit<CategoryRailProps, 'variant'> & { tabs: boolean; className?: string }) {
  const railRef = useRef<HTMLDivElement>(null)

  // Keep the active chip in view as scroll-spy moves the highlight (mobile
  // parity). block: 'nearest' leaves the page's vertical scroll untouched.
  useEffect(() => {
    railRef.current
      ?.querySelector(`[data-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  // Mobile has no app bar, so the rail sticks right below the status-bar
  // inset; desktop sticks below the header (its height is the brand's)
  return (
    <div
      className={cn(
        'bg-background/95 sticky top-[env(safe-area-inset-top)] z-30 -mx-4 px-4 py-2 backdrop-blur md:top-(--header-h)',
        tabs && 'border-b',
        className
      )}
    >
      <div ref={railRef} className={cn('no-scrollbar flex overflow-x-auto', tabs ? 'gap-5' : 'gap-2')}>
        {sections.map((section) =>
          tabs ? (
            <button
              key={section.id}
              type='button'
              data-id={section.id}
              data-active={section.id === activeId}
              className={cn(
                'relative h-9 shrink-0 text-sm font-medium whitespace-nowrap transition-colors',
                'text-muted-foreground hover:text-foreground data-[active=true]:text-foreground',
                // The underline sits on the bar's own bottom edge
                "after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-transparent after:content-[''] data-[active=true]:after:bg-primary"
              )}
              onClick={() => onSelect(section.id)}
            >
              {section.label}
            </button>
          ) : (
            <Button
              key={section.id}
              data-id={section.id}
              size='sm'
              variant={section.id === activeId ? 'default' : 'outline'}
              className='shrink-0 rounded-pill'
              onClick={() => onSelect(section.id)}
            >
              {section.label}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

/** The categories down the side of a wide screen, sticking under the header as the menu scrolls. */
function SideList({ sections, activeId, onSelect }: Omit<CategoryRailProps, 'variant'>) {
  return (
    <nav className='sticky top-[calc(var(--header-h)+1rem)] hidden max-h-[calc(100svh-var(--header-h)-2rem)] self-start overflow-y-auto md:col-start-1 md:row-start-1 md:block'>
      <ul className='flex flex-col gap-0.5'>
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type='button'
              data-active={section.id === activeId}
              className={cn(
                'w-full rounded-(--radius-button) px-3 py-2 text-start text-sm transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                'data-[active=true]:bg-secondary data-[active=true]:text-secondary-foreground data-[active=true]:font-semibold'
              )}
              onClick={() => onSelect(section.id)}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
