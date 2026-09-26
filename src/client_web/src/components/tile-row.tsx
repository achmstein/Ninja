import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Tiles in the Ninja style: rows in one lifted group, each an icon in a
 * round tile, a label (and a line under it), the row's current setting and
 * a chevron. A press darkens the row; nothing jumps.
 */
export function TileGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('surface divide-border/60 flex flex-col divide-y overflow-hidden rounded-[1.5rem]', className)}>
      {children}
    </div>
  )
}

const rowClasses =
  'active:bg-muted/70 hover:bg-muted/40 flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors'

type TileContentProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel?: React.ReactNode
  /** The row's current setting, before the chevron */
  value?: React.ReactNode
  destructive?: boolean
  /** In place of the chevron: a switch, a badge; null for nothing */
  trailing?: React.ReactNode
}

function TileContent({ icon: Icon, label, sublabel, value, destructive, trailing }: TileContentProps) {
  return (
    <>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
        )}
      >
        <Icon className='size-[18px]' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className={cn('block truncate text-[15px] font-semibold', destructive && 'text-destructive')}>{label}</span>
        {sublabel && <span className='text-muted-foreground block text-[13px]'>{sublabel}</span>}
      </span>
      {value && <span className='text-muted-foreground shrink-0 text-[13px]'>{value}</span>}
      {trailing === undefined ? (
        <ChevronRight className={cn('size-4 shrink-0 rtl:rotate-180', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      ) : (
        trailing
      )}
    </>
  )
}

export function TileLink({ to, ...content }: TileContentProps & { to: LinkProps['to'] }) {
  return (
    <Link to={to} className={rowClasses}>
      <TileContent {...content} />
    </Link>
  )
}

export function TileAnchor({ href, ...content }: TileContentProps & { href: string }) {
  return (
    <a href={href} className={rowClasses}>
      <TileContent {...content} />
    </a>
  )
}

// Plain button props pass through so it works as an AlertDialogTrigger
// via asChild
export function TileButton({
  icon,
  label,
  sublabel,
  value,
  destructive,
  trailing,
  className,
  ...props
}: TileContentProps & React.ComponentProps<'button'>) {
  return (
    <button type='button' className={cn(rowClasses, 'disabled:opacity-50', className)} {...props}>
      <TileContent icon={icon} label={label} sublabel={sublabel} value={value} destructive={destructive} trailing={trailing} />
    </button>
  )
}

/** A row that is not a button: its trailing control (a switch) does the work */
export function TileRow({ className, ...content }: TileContentProps & { className?: string }) {
  return (
    <div className={cn(rowClasses, 'hover:bg-transparent active:bg-transparent', className)}>
      <TileContent {...content} />
    </div>
  )
}
