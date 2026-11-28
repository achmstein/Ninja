import { Check, User, Users } from 'lucide-react'
import type { RateOptionViewModel } from '@/api/spaces/types.gen'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Segmented picker over a tariff's rate options — the Single/Multi toggle
 * the tills always had, now one button per option, sized for a thumb.
 * `rates` prints each option's hourly price after its name, so the cashier
 * sees them all while choosing. Renders nothing for a one-rate tariff:
 * there is nothing to pick. Side by side, a rate goes under its option's
 * name, so two options fit a phone. `stacked` puts one option a row, the name at
 * the start and the rate at the end: for a narrow column (the bill's
 * panel), where side by side they overflow.
 */
export function RateOptionToggle({
  options,
  value,
  onChange,
  disabled,
  className,
  rates,
  stacked = false,
}: {
  options: RateOptionViewModel[]
  value: string | null
  onChange: (code: string) => void
  disabled?: boolean
  className?: string
  rates?: Record<string, string>
  stacked?: boolean
}) {
  const localized = useLocalized()
  if (options.length < 2) return null

  if (stacked) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {options.map((option, index) => {
          const code = option.code ?? ''
          const selected = value === code
          const Icon = index === 0 ? User : Users
          return (
            <button
              key={code}
              type='button'
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(code)}
              className={cn(
                'flex h-12 items-center gap-2 rounded-lg border px-4 text-base transition-colors disabled:opacity-50',
                // The one in force in the till's dark fill with a tick beside
                // its rate, as on the Android till: a light grey fill next to
                // a white row did not say which was chosen
                selected
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : 'bg-background hover:bg-muted',
              )}
            >
              <Icon className='size-5 shrink-0' />
              <span className='min-w-0 flex-1 truncate text-start'>
                {localized(option.name)}
              </span>
              {rates?.[code] && (
                <span
                  className={cn(
                    'shrink-0 type-detail tabular-nums',
                    selected
                      ? 'text-primary-foreground/80'
                      : 'text-muted-foreground',
                  )}
                >
                  {rates[code]}
                </span>
              )}
              {selected && <Check className='size-5 shrink-0' />}
            </button>
          )
        })}
      </div>
    )
  }

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
              // min-w-0: a column never grows past its share, so a long name
              // or rate is cut inside its button, never pushed off a phone
              'flex min-w-0 items-center justify-center gap-2 rounded-lg border px-2 text-base font-medium transition-colors disabled:opacity-50',
              rates ? 'h-14' : 'h-12',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            <Icon className='size-5 shrink-0' />
            {/* The rate sits under the name, not beside it: side by side the
                two buttons were wider than a phone */}
            <span className='flex min-w-0 flex-col items-start leading-5'>
              <span className='max-w-full truncate'>{localized(option.name)}</span>
              {rates?.[code] && (
                <span
                  className={cn(
                    'type-caption max-w-full truncate tabular-nums',
                    selected
                      ? 'text-primary-foreground/80'
                      : 'text-muted-foreground',
                  )}
                >
                  {rates[code]}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
