import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type ComboboxOption = {
  value: string
  label: string
  /** Secondary text after the label (a unit, a category) */
  hint?: string
}

type ComboboxProps = {
  value: string | null
  onChange: (value: string | null) => void
  options: ComboboxOption[]
  placeholder: string
  /** Shown as a first entry that clears the pick (filters, not forms) */
  clearLabel?: string
  disabled?: boolean
  className?: string
  size?: 'sm' | 'default'
  /** Wrap a long label onto more lines instead of cutting it off */
  wrap?: boolean
}

/**
 * Single-pick searchable select (Popover + Command): the stock item and
 * menu item pickers. Filtering is cmdk's, matched on label and hint.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  clearLabel,
  disabled,
  className,
  // h-9 by default, the same height as Input, so it lines up in form rows
  size = 'sm',
  wrap = false,
}: ComboboxProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          size={size}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            wrap &&
              (size === 'sm' ? 'h-auto min-h-8 py-1' : 'h-auto min-h-9 py-1'),
            className
          )}
        >
          <span
            className={
              wrap ? 'text-start break-words whitespace-normal' : 'truncate'
            }
          >
            {selected ? selected.label : placeholder}
            {selected?.hint && (
              <span className='text-muted-foreground'> · {selected.hint}</span>
            )}
          </span>
          <ChevronsUpDown className='ms-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0'
        align='start'
      >
        <Command>
          <CommandInput placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('noResults')}</CommandEmpty>
            {clearLabel && value !== null && (
              <>
                <CommandGroup>
                  <CommandItem
                    value='__clear'
                    onSelect={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                  >
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.hint ?? '']}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'me-2 h-4 w-4',
                      option.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>{option.label}</span>
                  {option.hint && (
                    <span className='text-muted-foreground ms-auto ps-2 text-xs'>
                      {option.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
