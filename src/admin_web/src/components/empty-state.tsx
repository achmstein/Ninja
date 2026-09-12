import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

type EmptyStateProps = {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** A way forward: the create button, a clear-filters link */
  action?: React.ReactNode
  /** Tighter padding inside panels and sheets */
  compact?: boolean
  className?: string
}

/**
 * The one empty state. A list that is empty because of filters should say
 * so in `title`/`description` and offer clearing them as the `action`.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn(compact ? 'gap-4 p-6 md:p-6' : 'py-16', className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant='icon'>
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
