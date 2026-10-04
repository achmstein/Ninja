import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, RotateCcw } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { InfoTip } from '@/components/info-tip'

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
  /** h-8 trigger, for a dense table toolbar; otherwise h-9 like the inputs */
  compact?: boolean
  className?: string
}

/**
 * The one date-range control, in the shadcn date-picker shape: an outline
 * button naming the current range, opening a popover with the presets
 * beside a two-month range calendar. State lives in the route search
 * (`range`, `from`, `to`); the page's default preset is written as undefined.
 * Under the calendar, the start and end times stand in for the branch's
 * business hours (`fromTime`, `toTime`) and stay put across presets.
 */
export function DateRangePicker({
  search,
  dayWindow,
  onChange,
  defaultPreset = 'today',
  children,
  compact = false,
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

  const shortDay = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  })
  const span =
    dayWindow && preset !== 'all'
      ? dayWindow.to.getTime() - dayWindow.from.getTime() <= 86_400_000
        ? `${format(dayWindow.from, 'HH:mm')} → ${format(dayWindow.to, 'HH:mm')}`
        : `${shortDay.format(dayWindow.from)} → ${shortDay.format(
            new Date(dayWindow.to.getTime() - 1)
          )}`
      : null

  const pickPreset = (next: RangeKey) => {
    onChange({
      range: next === defaultPreset ? undefined : next,
      from: undefined,
      to: undefined,
    })
    setOpen(false)
  }

  // The hours in force: the picked ones, else the window's (branch hours)
  const startTime =
    search.fromTime ?? (dayWindow ? format(dayWindow.from, 'HH:mm') : '')
  const endTime =
    search.toTime ?? (dayWindow ? format(dayWindow.to, 'HH:mm') : '')
  const hoursPicked = search.fromTime != null || search.toTime != null
  const pickTime = (key: 'fromTime' | 'toTime', value: string) =>
    onChange({ [key]: value || undefined })

  const pickRange = (range: DateRange | undefined) => {
    onChange({
      range: 'custom',
      from: range?.from ? formatDay(range.from) : undefined,
      to: range?.to ? formatDay(range.to) : undefined,
    })
    // Two clicks make a range; close once both ends are in
    if (range?.from && range?.to) setOpen(false)
  }

  // The presets, the calendar and the hours: beside each other on a desk,
  // one under the other in a sheet from the bottom on a phone
  const panel = (
    <div className={cn('flex', isMobile && 'flex-col')}>
      <div
        className={cn(
          'flex gap-0.5 p-2',
          isMobile ? 'flex-wrap gap-2 border-b' : 'flex-col border-e'
        )}
      >
        {presets.map((p) => (
          <Button
            key={p}
            variant={
              preset === p ? 'secondary' : isMobile ? 'outline' : 'ghost'
            }
            size='sm'
            className={cn('justify-start', isMobile && 'rounded-full')}
            onClick={() => pickPreset(p)}
          >
            {t(presetKeys[p])}
          </Button>
        ))}
      </div>
      <div className='flex flex-col'>
        <Calendar
          mode='range'
          className={cn(isMobile && 'mx-auto')}
          numberOfMonths={isMobile ? 1 : 2}
          defaultMonth={from ?? new Date()}
          selected={preset === 'custom' ? { from, to } : undefined}
          onSelect={pickRange}
          disabled={(date: Date) => date > new Date()}
        />
        {preset !== 'all' && dayWindow && (
          <div className='flex flex-col gap-2 border-t p-3'>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='grid gap-1'>
                <Label htmlFor='range-from-time' className='text-xs'>
                  {t('rangeStartsAt')}
                </Label>
                <Input
                  id='range-from-time'
                  type='time'
                  className='h-8 w-28 tabular-nums'
                  value={startTime}
                  onChange={(e) => pickTime('fromTime', e.target.value)}
                />
              </div>
              <div className='grid gap-1'>
                <Label htmlFor='range-to-time' className='text-xs'>
                  {t('rangeEndsAt')}
                </Label>
                <Input
                  id='range-to-time'
                  type='time'
                  className='h-8 w-28 tabular-nums'
                  value={endTime}
                  onChange={(e) => pickTime('toTime', e.target.value)}
                />
              </div>
              <InfoTip className='mb-1.5'>{t('rangeHoursHint')}</InfoTip>
              {hoursPicked && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='ms-auto'
                  onClick={() =>
                    onChange({ fromTime: undefined, toTime: undefined })
                  }
                >
                  <RotateCcw />
                  {t('wholeDay')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              className={cn(
                'min-w-[11rem] justify-start font-normal',
                compact ? 'h-8' : 'h-9'
              )}
            >
              <CalendarIcon className='text-muted-foreground' />
              <span className='truncate font-medium'>{label}</span>
              {/* The window itself, once, where the range is chosen: not again as a line beside it */}
              {span && preset !== 'custom' && (
                <span className='text-muted-foreground truncate tabular-nums'>
                  · {span}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side='bottom' className='overflow-y-auto p-0'>
            <SheetHeader className='pb-3'>
              <SheetTitle>{t('pickADate')}</SheetTitle>
              <SheetDescription className='sr-only'>{label}</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              className={cn(
                'min-w-[11rem] justify-start font-normal',
                compact ? 'h-8' : 'h-9'
              )}
            >
              <CalendarIcon className='text-muted-foreground' />
              <span className='truncate font-medium'>{label}</span>
              {/* The window itself, once, where the range is chosen: not again as a line beside it */}
              {span && preset !== 'custom' && (
                <span className='text-muted-foreground truncate tabular-nums'>
                  · {span}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align='start' className='w-auto p-0'>
            {panel}
          </PopoverContent>
        </Popover>
      )}

      {children}
    </div>
  )
}
