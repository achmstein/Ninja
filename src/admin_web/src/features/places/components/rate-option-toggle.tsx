import { User, Users } from 'lucide-react'
import { type RateOptionViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatRate } from '../status'

/**
 * Segmented picker over a tariff's rate options — one button per option,
 * each with its hourly price. Renders nothing for a one-rate tariff: there
 * is nothing to pick.
 */
export function RateOptionToggle({
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  options: RateOptionViewModel[]
  value: string | null
  onChange: (code: string) => void
  disabled?: boolean
  className?: string
}) {
  const t = useT()
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
              'flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <Icon className='h-4 w-4' />
            {localized(option.name)}
            <span
              className={cn(
                'text-xs tabular-nums',
                selected
                  ? 'text-primary-foreground/80'
                  : 'text-muted-foreground'
              )}
            >
              {formatRate(option.hourlyRate)}
              {t('perHour')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
