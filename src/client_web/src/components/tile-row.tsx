import { Link, type LinkProps } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { springOpen } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { pushTitleId } from '@/components/ninja/page/push'

/**
 * Tiles in the Ninja style: rows in one filled group, flat like the request
 * tiles and the dock (no shadow), each an icon in a round tile, a label (and
 * a line under it), the row's current setting and a chevron. A press shades
 * the row; nothing jumps.
 */
export function TileGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-muted divide-background/70 flex flex-col divide-y overflow-hidden rounded-[1.5rem]', className)}>
      {children}
    </div>
  )
}

const rowClasses =
  'active:bg-foreground/[0.06] hover:bg-foreground/[0.03] flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors'

type TileContentProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel?: React.ReactNode
  /** The row's current setting, before the chevron */
  value?: React.ReactNode
  destructive?: boolean
  /** In place of the chevron: a switch, a badge; null for nothing */
  trailing?: React.ReactNode
  /** The page it opens, whose title its name travels into (components/ninja/page/push.ts) */
  push?: string
}

function TileContent({ icon: Icon, label, sublabel, value, destructive, trailing, push }: TileContentProps) {
  return (
    <>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          destructive ? 'bg-destructive/10 text-destructive' : 'bg-background text-foreground'
        )}
      >
        <Icon className='size-[18px]' />
      </span>
      <span className='min-w-0 flex-1'>
        {/* Sized to its words, so the name grows into the title without stretching */}
        <motion.span
          layoutId={push ? pushTitleId(push) : undefined}
          transition={springOpen}
          className={cn('inline-block max-w-full truncate align-top text-[15px] font-semibold', destructive && 'text-destructive')}
        >
          {label}
        </motion.span>
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

