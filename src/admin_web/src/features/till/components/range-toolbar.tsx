import { CalendarRange } from 'lucide-react'
import {
  formatDay,
  parseDay,
  rangePresets,
  type DayWindow,
  type RangePreset,
} from '@/lib/business-day'
import { useLocale, useT, type TranslationKey } from '@/lib/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { type RangeSearch } from '../search'

const presetKeys: Record<RangePreset, TranslationKey> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last7Days',
  '30d': 'last30Days',
  custom: 'rangeCustom',
}

type RangeToolbarProps = {
  search: RangeSearch
  dayWindow: DayWindow | null
  /** Receives the search patch to merge (undefined clears a key). */
  onChange: (next: RangeSearch) => void
  children?: React.ReactNode
}

/**
 * Preset picker (today, yesterday, 7d, 30d) or two calendar days, plus the
 * business-day window they resolve to — so the reader sees that "today"
 * means 17:00 yesterday to 05:00, not midnight to midnight.
 */
export function RangeToolbar({
  search,
  dayWindow,
  onChange,
  children,
}: RangeToolbarProps) {
  const t = useT()
  const locale = useLocale()
  const preset: RangePreset = search.range ?? 'today'
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select
        value={preset}
        onValueChange={(value) => {
          const next = value as RangePreset
          onChange({
            range: next === 'today' ? undefined : next,
            from:
              next === 'custom'
                ? (search.from ?? formatDay(new Date()))
                : undefined,
            to: next === 'custom' ? search.to : undefined,
          })
        }}
      >
        <SelectTrigger size='sm' className='h-8 w-[150px]'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rangePresets.map((value) => (
            <SelectItem key={value} value={value}>
              {t(presetKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <>
          <DatePicker
            selected={parseDay(search.from)}
            onSelect={(date) =>
              onChange({
                range: 'custom',
                from: date ? formatDay(date) : undefined,
                to: search.to,
              })
            }
            placeholder={t('rangeFrom')}
          />
          <DatePicker
            selected={parseDay(search.to)}
            onSelect={(date) =>
              onChange({
                range: 'custom',
                from: search.from,
                to: date ? formatDay(date) : undefined,
              })
            }
            placeholder={t('rangeTo')}
          />
        </>
      )}

      {children}

      {dayWindow && (
        <span className='text-muted-foreground ms-auto flex items-center gap-1.5 text-xs tabular-nums'>
          <CalendarRange className='h-3.5 w-3.5' />
          {dateTime.format(dayWindow.from)} – {dateTime.format(dayWindow.to)}
        </span>
      )}
    </div>
  )
}
