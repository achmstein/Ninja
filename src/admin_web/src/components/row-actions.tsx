import type { ComponentType } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type RowAction = {
  label: string
  icon?: ComponentType<{ className?: string }>
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
}

/**
 * A row's actions behind one ⋯, where a cluster of icon buttons outweighed
 * the row's own data. A destructive one sits last, apart and in red. Clicks
 * stay inside, so a row that opens on click does not open too.
 */
export function RowActions({
  actions,
  className,
}: {
  actions: RowAction[]
  className?: string
}) {
  const t = useT()
  const shown = actions.filter((a) => !a.hidden)
  if (shown.length === 0) return null
  const plain = shown.filter((a) => !a.destructive)
  const risky = shown.filter((a) => a.destructive)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn('text-muted-foreground size-8 shrink-0', className)}
          aria-label={t('moreActions')}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' onClick={(e) => e.stopPropagation()}>
        {plain.map((a) => (
          <DropdownMenuItem
            key={a.label}
            disabled={a.disabled}
            onSelect={a.onSelect}
          >
            {a.icon && <a.icon className='size-4' />}
            {a.label}
          </DropdownMenuItem>
        ))}
        {plain.length > 0 && risky.length > 0 && <DropdownMenuSeparator />}
        {risky.map((a) => (
          <DropdownMenuItem
            key={a.label}
            variant='destructive'
            disabled={a.disabled}
            onSelect={a.onSelect}
          >
            {a.icon && <a.icon className='size-4' />}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
