import { type ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * A badge that says why when the pointer rests on it: "Tracked" opens to
 * what tracking does and what the food cost is. A fast answer in place, for
 * a mouse; on a phone the row opens to the full story.
 */
export function InfoBadge({
  badge,
  title,
  children,
}: {
  /** The badge itself, as the row shows it */
  badge: ReactNode
  /** The first line, in bold: what the badge means */
  title: ReactNode
  /** The lines under it: why, and what follows */
  children?: ReactNode
}) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className='inline-flex cursor-default'>{badge}</span>
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-64 text-start'>
        <div className='font-semibold'>{title}</div>
        {children && (
          <div className='mt-1 space-y-0.5 opacity-90'>{children}</div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
