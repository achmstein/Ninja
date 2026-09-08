import { User, Users } from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PlayerMode } from './status'

/**
 * Segmented Single/Multi picker, the same one the admin apps use, sized for
 * a thumb. With `allowNone`, leaving both unselected means "not decided
 * yet" — the server bills at the single rate until a mode is set. `rates`
 * prints each mode's hourly price after its label, so the cashier sees
 * both while choosing.
 */
export function PlayerModeToggle({
  value,
  onChange,
  allowNone,
  disabled,
  className,
  rates,
}: {
  value: PlayerMode | null
  onChange: (mode: PlayerMode | null) => void
  allowNone?: boolean
  disabled?: boolean
  className?: string
  rates?: Partial<Record<PlayerMode, string>>
}) {
  const t = useT()
  const options: {
    mode: PlayerMode
    label: TranslationKey
    icon: typeof User
  }[] = [
    { mode: 'Single', label: 'playerModeSingle', icon: User },
    { mode: 'Multi', label: 'playerModeMulti', icon: Users },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      {options.map(({ mode, label, icon: Icon }) => {
        const selected = value === mode
        return (
          <button
            key={mode}
            type='button'
            disabled={disabled}
            onClick={() => onChange(selected && allowNone ? null : mode)}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium transition-colors disabled:opacity-50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <Icon className='size-5' />
            {t(label)}
            {rates?.[mode] && (
              <span
                className={cn(
                  'text-sm tabular-nums',
                  selected
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground'
                )}
              >
                · {rates[mode]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
