import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { formatDay, parseDay } from '@/lib/business-day'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type DatePickerProps = {
  /** yyyy-MM-dd, the shape a DateOnly travels in */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  /** Days that cannot be picked (a future day, say) */
  disabled?: (date: Date) => boolean
  className?: string
}

/**
 * One day, picked from the same calendar the range picker uses, so a form
 * never shows the browser's own date control beside the app's. Input
 * height, so it sits in a row with inputs and selects.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  className,
}: DatePickerProps) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const selected = parseDay(value)
  const label = selected
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(selected)
    : (placeholder ?? '')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          size='sm'
          className={cn(
            'w-full justify-start font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className='text-muted-foreground' />
          <span className='truncate'>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-auto p-0'>
        <Calendar
          mode='single'
          defaultMonth={selected ?? new Date()}
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onChange(formatDay(date))
            setOpen(false)
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
