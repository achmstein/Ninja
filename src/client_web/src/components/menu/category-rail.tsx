import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

export type MenuSection = {
  id: string
  label: string
}

interface CategoryRailProps {
  sections: MenuSection[]
  activeId: string
  onSelect: (id: string) => void
}

/** Sticky category chip rail, scroll-synced with the menu sections. */
export function CategoryRail({ sections, activeId, onSelect }: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement>(null)

  // Keep the active chip in view as scroll-spy moves the highlight (mobile
  // parity). block: 'nearest' leaves the page's vertical scroll untouched.
  useEffect(() => {
    railRef.current
      ?.querySelector(`[data-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  // Mobile has no app bar, so the rail sticks right below the status-bar
  // inset; desktop sticks below the h-14 header
  return (
    <div className='bg-background/95 sticky top-[env(safe-area-inset-top)] z-30 -mx-4 px-4 py-2 backdrop-blur md:top-14'>
      <div ref={railRef} className='no-scrollbar flex gap-2 overflow-x-auto'>
        {sections.map((section) => (
          <Button
            key={section.id}
            data-id={section.id}
            size='sm'
            variant={section.id === activeId ? 'default' : 'outline'}
            className='shrink-0 rounded-full'
            onClick={() => onSelect(section.id)}
          >
            {section.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
