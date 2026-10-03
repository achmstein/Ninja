import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type ChipTone =
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'muted'
  | 'outline'

/**
 * A state at a glance (Paid, Pending, No-show, Expired…): a soft tint of its
 * colour rather than a solid block, so a row's name stays the loudest thing
 * on it. An icon or a dot may lead.
 */
export function StatusChip({
  tone,
  icon: Icon,
  dot = true,
  children,
  className,
}: {
  tone: ChipTone
  icon?: ComponentType<{ className?: string }>
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Badge
      variant={tone}
      className={cn('gap-1.5 rounded-full px-2', className)}
    >
      {dot && !Icon && (
        <span aria-hidden className='size-1.5 rounded-full bg-current' />
      )}
      {Icon && <Icon className='size-3' />}
      {children}
    </Badge>
  )
}
