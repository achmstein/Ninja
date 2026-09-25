import { useBranchFlags } from '@/features/branch/use-branch-flags'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type FlagRowProps = {
  label: string
  on: boolean
  disabled: boolean
  onChange: (on: boolean) => void
  className?: string
}

function FlagRow({ label, on, disabled, onChange, className }: FlagRowProps) {
  const t = useT()
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-2',
        className
      )}
    >
      <span className='flex items-center gap-2 text-base font-medium'>
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            on ? 'bg-emerald-500' : 'bg-amber-500'
          )}
        />
        {label}
        {!on && (
          <span className='text-muted-foreground text-xs font-normal'>
            {t('paused')}
          </span>
        )}
      </span>
      <Switch checked={on} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * The branch's two customer-facing switches — taking orders, taking
 * reservations — for a mid-day pause. The shift flips both on its own
 * (open → on, close → off); the switches are for in between, so they sit
 * on the shift screen the header chip leads to.
 */
export function TradingSwitches({ className }: { className?: string }) {
  const t = useT()
  const flags = useBranchFlags()
  const disabled = !flags.branch || flags.isPending

  return (
    <div className={cn('bg-card rounded-xl border', className)}>
      <FlagRow
        label={t('takingOrders')}
        on={flags.takingOrders}
        disabled={disabled}
        onChange={flags.setTakingOrders}
      />
      <FlagRow
        label={t('takingReservations')}
        on={flags.takingReservations}
        disabled={disabled}
        onChange={flags.setTakingReservations}
        className='border-t'
      />
    </div>
  )
}
