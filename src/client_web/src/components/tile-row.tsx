import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Web equivalent of the app's FTile: icon + label (+ optional sublabel) +
// chevron, meant to live inside a `Card className='gap-0 divide-y p-0'`.

const rowClasses =
  'hover:bg-accent flex w-full items-center gap-3 p-4 text-start font-medium transition-colors first:rounded-t-xl last:rounded-b-xl'

type TileContentProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel?: React.ReactNode
  /** The row's current setting, before the chevron */
  value?: React.ReactNode
  destructive?: boolean
}

function TileContent({
  icon: Icon,
  label,
  sublabel,
  value,
  destructive,
}: TileContentProps) {
  return (
    <>
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          destructive ? 'text-destructive' : 'text-muted-foreground'
        )}
      />
      {/* 15px/13px — the row convention used by the menu and orders lists */}
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-[15px]'>{label}</span>
        {sublabel && (
          <span className='text-muted-foreground block text-[13px] font-normal'>
            {sublabel}
          </span>
        )}
      </span>
      {value && (
        <span className='text-muted-foreground shrink-0 text-[13px] font-normal'>
          {value}
        </span>
      )}
      <ChevronRight
        className={cn(
          'h-4 w-4 shrink-0 rtl:rotate-180',
          destructive ? 'text-destructive' : 'text-muted-foreground'
        )}
      />
    </>
  )
}

export function TileLink({
  to,
  ...content
}: TileContentProps & { to: LinkProps['to'] }) {
  return (
    <Link to={to} className={rowClasses}>
      <TileContent {...content} />
    </Link>
  )
}

export function TileAnchor({
  href,
  ...content
}: TileContentProps & { href: string }) {
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
  className,
  ...props
}: TileContentProps & React.ComponentProps<'button'>) {
  return (
    <button
      type='button'
      className={cn(
        rowClasses,
        destructive && 'text-destructive',
        'disabled:opacity-50',
        className
      )}
      {...props}
    >
      <TileContent
        icon={icon}
        label={label}
        sublabel={sublabel}
        value={value}
        destructive={destructive}
      />
    </button>
  )
}
