import { useState } from 'react'
import { CalendarIcon, CalendarRange } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import {
  formatDay,
  parseDay,
  rangePresets,
  type DayWindow,
} from '@/lib/business-day'
import { useLocale, useT, type TranslationKey } from '@/lib/i18n'
import { type RangeKey, type RangeSearch } from '@/lib/search-schemas'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const presetKeys: Record<RangeKey, TranslationKey> = {
  all: 'allTime',
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last7Days',
  '30d': 'last30Days',
  custom: 'rangeCustom',
}

type DateRangePickerProps = {
  search: RangeSearch
  /** The resolved business-day window, shown so "today" reads as 17:00 → 05:00 */
  dayWindow?: DayWindow | null
  /** Receives the search patch to merge (undefined clears a key) */
  onChange: (next: RangeSearch) => void
  /**
   * What an absent `range` means. Reports default to today; history tables
   * default to everything and offer "All time" as a preset.
   */
  defaultPreset?: 'today' | 'all'
  /** Extra controls on the same row (a lookup field, a filter) */
  children?: React.ReactNode
  className?: string
}

/**
 * The one date-range control, in the shadcn date-picker shape: an outline
 * button naming the current range, opening a popover with the presets
 * beside a two-month range calendar. State lives in the route search
 * (`range`, `from`, `to`); the page's default preset is written as undefined.
 */
export function DateRangePicker({
  search,
  dayWindow,
  onChange,
  defaultPreset = 'today',
  children,
  className,
}: DateRangePickerProps) {
  const t = useT()
  const locale = useLocale()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const preset: RangeKey = search.range ?? defaultPreset
  const from = parseDay(search.from)
  const to = parseDay(search.to)
  const presets: RangeKey[] = [
    ...(defaultPreset === 'all' ? (['all'] as RangeKey[]) : []),
    ...rangePresets.filter((p) => p !== 'custom'),
  ]

  const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const day = (date: Date) => dayFormat.format(date)
  const label =
    preset === 'custom'
      ? from
        ? to
          ? `${day(from)} – ${day(to)}`
          : day(from)
        : t('pickADate')
      : t(presetKeys[preset])

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const pickPreset = (next: RangeKey) => {
    onChange({
      range: next === defaultPreset ? undefined : next,
      from: undefined,
      to: undefined,
    })
    setOpen(false)
  }

  const pickRange = (range: DateRange | undefined) => {
    onChange({
      range: 'custom',
      from: range?.from ? formatDay(range.from) : undefined,
      to: range?.to ? formatDay(range.to) : undefined,
    })
    // Two clicks make a range; close once both ends are in
    if (range?.from && range?.to) setOpen(false)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='h-8 min-w-[11rem] justify-start font-normal'
          >
            <CalendarIcon className='text-muted-foreground' />
            <span className='truncate'>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align='start' className='flex w-auto p-0'>
          <div className='flex flex-col gap-0.5 border-e p-2'>
            {presets.map((p) => (
              <Button
                key={p}
                variant={preset === p ? 'secondary' : 'ghost'}
                size='sm'
                className='justify-start'
                onClick={() => pickPreset(p)}
              >
                {t(presetKeys[p])}
              </Button>
            ))}
          </div>
          <Calendar
            mode='range'
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={from ?? new Date()}
            selected={preset === 'custom' ? { from, to } : undefined}
            onSelect={pickRange}
            disabled={(date: Date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>

      {children}

      {dayWindow && preset !== 'all' && (
        <span className='text-muted-foreground ms-auto flex items-center gap-1.5 text-xs tabular-nums'>
          <CalendarRange className='h-3.5 w-3.5' />
          {dateTime.format(dayWindow.from)} – {dateTime.format(dayWindow.to)}
        </span>
      )}
    </div>
  )
}
