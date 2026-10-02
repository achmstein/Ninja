import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatFull, formatWhen, type WhenMode } from '@/lib/when'

/**
 * A moment, said the admin's one way (lib/when.ts), with the full date and
 * time on hover for any shorter form.
 */
export function When({
  value,
  mode = 'relative',
  className,
}: {
  value: Date | string | number | null | undefined
  mode?: WhenMode
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const text = formatWhen(value, mode, locale, t)
  return (
    <time
      dateTime={value == null ? undefined : new Date(value).toISOString()}
      title={mode === 'dateTime' ? undefined : formatFull(value, locale)}
      className={cn('tabular-nums', className)}
    >
      {text}
    </time>
  )
}
