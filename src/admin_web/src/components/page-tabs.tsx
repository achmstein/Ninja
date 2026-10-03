import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ActiveMarker } from '@/components/motion'

type PageTab = {
  value: string
  label: React.ReactNode
  to: LinkProps['to']
  search?: LinkProps['search']
  /** A count next to the label (pending orders, open tickets) */
  badge?: number
}

type PageTabsProps = {
  value: string
  tabs: PageTab[]
  /**
   * A second row inside one tab (History's kinds of record): no well and a
   * smaller type, so it reads as a choice within the tab above it
   */
  quiet?: boolean
  className?: string
}

/**
 * Sibling pages of one section (Live | History, Sales | Tickets | …) as a
 * tab row of links, so each tab is a real URL. Sits under the PageHeader.
 */
export function PageTabs({ value, tabs, quiet, className }: PageTabsProps) {
  return (
    <nav
      role='tablist'
      className={cn(
        'text-muted-foreground inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto',
        quiet ? 'h-8' : 'bg-muted h-9 rounded-lg p-[3px]',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <Link
            key={tab.value}
            to={tab.to}
            search={tab.search}
            role='tab'
            aria-selected={active}
            data-state={active ? 'active' : 'inactive'}
            className={cn(
              'focus-visible:ring-ring/50 relative isolate inline-flex h-full items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]',
              quiet ? 'px-2.5 text-[13px]' : 'px-3 text-sm',
              active ? 'text-foreground' : 'hover:text-foreground'
            )}
          >
            {active && (
              <ActiveMarker
                group={quiet ? 'page-tabs-quiet' : 'page-tabs'}
                className={
                  quiet
                    ? 'bg-muted rounded-md'
                    : 'bg-background dark:bg-input/40 rounded-md shadow-sm'
                }
              />
            )}
            {tab.label}
            {tab.badge ? (
              <Badge
                variant={active ? 'default' : 'secondary'}
                className='h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums'
              >
                {tab.badge}
              </Badge>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
