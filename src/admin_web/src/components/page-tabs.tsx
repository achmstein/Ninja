import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

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
  className?: string
}

/**
 * Sibling pages of one section (Live | History, Sales | Tickets | …) as a
 * tab row of links, so each tab is a real URL. Sits under the PageHeader.
 */
export function PageTabs({ value, tabs, className }: PageTabsProps) {
  return (
    <nav
      role='tablist'
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg p-[3px]',
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
              'focus-visible:ring-ring/50 inline-flex h-full items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
              active
                ? 'bg-background text-foreground dark:border-input dark:bg-input/30 shadow-sm'
                : 'hover:text-foreground'
            )}
          >
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
