import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { InfoTip } from '@/components/info-tip'

/**
 * One field: its label (with an ⓘ when the rule behind it needs saying),
 * the control, and what is wrong with it, always the same distance apart.
 * `htmlFor` ties the label to the control's id.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  end,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  /** The rule behind the field, a tap away */
  hint?: ReactNode
  /** A small control at the label's end (EN | ع, a link) */
  end?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-2', className)}>
      <div className='flex min-h-5 items-center gap-1'>
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <InfoTip>{hint}</InfoTip>}
        {end && <div className='ms-auto'>{end}</div>}
      </div>
      {children}
      {error && <p className='text-destructive text-sm'>{error}</p>}
    </div>
  )
}

/** Fields side by side on a desk, one under the other on a phone */
export function FieldGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * A yes-or-no: what it is and a line of what it does on the start side, the
 * switch on the end side. The whole row is the switch's label.
 */
export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <label htmlFor={id} className='min-w-0 flex-1 cursor-pointer'>
        <span className='block text-sm font-medium'>{title}</span>
        {description && (
          <span className='text-muted-foreground mt-0.5 block text-sm'>
            {description}
          </span>
        )}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}

/** Yes-or-no rows that belong together, in one bordered group */
export function SwitchGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'divide-border/60 divide-y rounded-lg border [&>*]:px-4 [&>*]:py-3',
        className
      )}
    >
      {children}
    </div>
  )
}
