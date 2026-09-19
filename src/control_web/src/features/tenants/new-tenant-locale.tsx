import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useLanguage, useT, type Language } from '@/lib/i18n'
import {
  COUNTRIES,
  CURRENCIES,
  CURRENCY_LABELS,
  allTimeZones,
  countryOf,
  type Country,
} from '@/lib/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type LocaleValue = {
  country: string
  currency: string
  timeZone: string
  defaultLanguage: Language
}

type LocaleFieldsProps = {
  value: LocaleValue
  /** The whole country, so the form can fill the rest from it */
  onCountry: (country: Country) => void
  onCurrency: (currency: string) => void
  onTimeZone: (timeZone: string) => void
  onDefaultLanguage: (language: Language) => void
}

/** `EGP — ج.م` in Arabic; plain `USD` where the label is the code itself. */
function currencyLabel(code: string, language: Language): string {
  const label = CURRENCY_LABELS[code]?.[language]
  return label && label !== code ? `${code} — ${label}` : code
}

/**
 * Where the café is and what follows from it. The country is picked from
 * the list; the money, the clock and the first language come with it and
 * can each be changed by hand.
 */
export function LocaleFields({
  value,
  onCountry,
  onCurrency,
  onTimeZone,
  onDefaultLanguage,
}: LocaleFieldsProps) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const country = countryOf(value.country)

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='grid gap-2'>
        <Label htmlFor='country'>{t('country')}</Label>
        <Select
          value={value.country}
          onValueChange={(code) => {
            const picked = countryOf(code)
            if (picked) onCountry(picked)
          }}
        >
          <SelectTrigger id='country' className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name[language]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='currency'>{t('currency')}</Label>
        <Select value={value.currency} onValueChange={onCurrency}>
          <SelectTrigger id='currency' className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {currencyLabel(code, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='timeZone'>{t('timeZone')}</Label>
        <TimeZoneField
          key={value.country}
          id='timeZone'
          zones={country?.timeZones ?? []}
          value={value.timeZone}
          onChange={onTimeZone}
        />
      </div>

      <div className='grid gap-2'>
        <Label>{t('defaultLanguage')}</Label>
        <ToggleGroup
          type='single'
          variant='outline'
          value={value.defaultLanguage}
          onValueChange={(v) => v && onDefaultLanguage(v as Language)}
          aria-label={t('defaultLanguage')}
          className='w-full'
        >
          <ToggleGroupItem value='ar' className='flex-1'>
            {t('arabic')}
          </ToggleGroupItem>
          <ToggleGroupItem value='en' className='flex-1'>
            {t('english')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

const MORE = '__more'

type TimeZoneFieldProps = {
  id: string
  /** The chosen country's zones */
  zones: string[]
  value: string
  onChange: (zone: string) => void
}

/**
 * The country's own zones in a plain select, with a last item that swaps
 * the field for a searchable list of every zone the browser knows. Once
 * the value is back among the country's zones the select returns.
 */
function TimeZoneField({ id, zones, value, onChange }: TimeZoneFieldProps) {
  const t = useT()
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const everyZone = useMemo(() => allTimeZones(), [])
  const listed = zones.includes(value)

  if (listed && !searching) {
    return (
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === MORE) {
            setSearching(true)
            setOpen(true)
          } else {
            onChange(v)
          }
        }}
      >
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {zones.map((zone) => (
            <SelectItem key={zone} value={zone}>
              <span dir='ltr'>{zone}</span>
            </SelectItem>
          ))}
          <SelectItem value={MORE}>{t('more')}…</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearching(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
        >
          <span dir='ltr' className='truncate'>
            {value}
          </span>
          <ChevronsUpDown className='size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-(--radix-popover-trigger-width) p-0'
      >
        <Command>
          <CommandInput placeholder={t('timeZone')} />
          <CommandList>
            <CommandGroup>
              {everyZone.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  onSelect={() => {
                    onChange(zone)
                    setSearching(false)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4',
                      zone === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span dir='ltr'>{zone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
