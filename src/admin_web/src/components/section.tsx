import { cn } from '@/lib/utils'

type SectionProps = {
  title: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  /** Buttons on the end side of the title row */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * One titled block inside a sheet or panel. Title on the start side, its
 * actions on the end side, the content below. There is no hint slot on
 * purpose: a section explains itself by its controls, or with an InfoTip
 * beside the title.
 */
export function Section({ title, icon: Icon, actions, children, className }: SectionProps) {
  return (
    <section className={cn('space-y-3 border-b p-4', className)}>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='flex items-center gap-2 text-sm font-medium'>
          {Icon && <Icon className='text-muted-foreground size-4' />}
          {title}
        </h3>
        {actions && <div className='flex flex-wrap gap-2'>{actions}</div>}
      </div>
      {children}
    </section>
  )
}
