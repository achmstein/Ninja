import { User, Users } from 'lucide-react'
import type { RateOptionViewModel } from '@/api/spaces/types.gen'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Segmented picker over a tariff's rate options — the Single/Multi toggle
 * the tills always had, now one button per option, sized for a thumb.
 * `rates` prints each option's hourly price after its name, so the cashier
 * sees them all while choosing. Renders nothing for a one-rate tariff:
 * there is nothing to pick.
 */
export function RateOptionToggle({
  options,
  value,
  onChange,
  disabled,
  className,
  rates,
}: {
  options: RateOptionViewModel[]
  value: string | null
  onChange: (code: string) => void
  disabled?: boolean
  className?: string
  rates?: Record<string, string>
}) {
  const localized = useLocalized()
  if (options.length < 2) return null

  return (
    <div
      className={cn('grid gap-2', className)}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option, index) => {
        const code = option.code ?? ''
        const selected = value === code
        // The first option is the base rate, the rest the upgrades
        const Icon = index === 0 ? User : Users
        return (
          <button
            key={code}
            type='button'
            disabled={disabled}
            onClick={() => onChange(code)}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium transition-colors disabled:opacity-50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            <Icon className='size-5' />
            {localized(option.name)}
            {rates?.[code] && (
              <span
                className={cn(
                  'text-sm tabular-nums',
                  selected
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground',
                )}
              >
                · {rates[code]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
