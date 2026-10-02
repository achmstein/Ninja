import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** yyyy-MM-dd as a local day, or undefined when it is not one. */
function parseDay(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined
}

type DatePickerProps = {
  /** yyyy-MM-dd, the shape a date input and a DateOnly travel in */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  /** Days that cannot be picked (one already past, say) */
  disabled?: (date: Date) => boolean
  className?: string
}

/**
 * One day, picked from the panel's own calendar rather than the browser's date control (the admin's
 * DatePicker, the same). Input height, so it sits in a row with inputs and selects.
 */
export function DatePicker({ value, onChange, id, placeholder, disabled, className }: DatePickerProps) {
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
          className={cn('w-full justify-start font-normal', !selected && 'text-muted-foreground', className)}
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
            onChange(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
