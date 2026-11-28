import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AddressDetail = {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  /** A number is typed (a floor) */
  numeric?: boolean
  /** Words are typed (a note): a wider field */
  wide?: boolean
  maxLength?: number
}

/**
 * What helps the rider find the door, each added only if the customer wants
 * to: the building, the floor, the apartment, a word for the rider (the street's
 * own box already takes a landmark, so this is never a second one). Three empty boxes
 * under the street read as three things owed; a row of small "+ Building"
 * chips reads as nothing owed at all. A tap turns a chip into its field,
 * Enter goes on to the next one not yet given, and a given one shows what
 * was typed and opens again on a tap.
 */
export function DetailChips({ title, optional, details }: { title: string; optional: string; details: AddressDetail[] }) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-baseline justify-between gap-3 px-1'>
        <span className='text-note font-semibold'>{title}</span>
        <span className='text-muted-foreground text-caption'>{optional}</span>
      </div>
      <div className='flex flex-wrap gap-2'>
        {details.map((detail, index) =>
          editing === detail.key ? (
            <label key={detail.key} className='border-primary text-note flex h-11 items-center gap-2 rounded-full border-2 ps-4 pe-3'>
              <span className='text-muted-foreground shrink-0'>{detail.label}</span>
              <input
                autoFocus
                value={detail.value}
                onChange={(e) => detail.onChange(e.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  // Enter is the next detail's, not the form's
                  e.preventDefault()
                  setEditing(details.slice(index + 1).find((next) => !next.value.trim())?.key ?? null)
                }}
                inputMode={detail.numeric ? 'numeric' : undefined}
                maxLength={detail.maxLength}
                aria-label={detail.label}
                // At least 16px, or iOS zooms the page into the field
                className={cn('min-w-0 bg-transparent text-base font-semibold outline-none', detail.wide ? 'w-44' : 'w-16')}
              />
            </label>
          ) : detail.value.trim() ? (
            <button
              key={detail.key}
              type='button'
              onClick={() => setEditing(detail.key)}
              className='bg-primary text-primary-foreground text-note flex h-11 max-w-full items-center gap-1.5 rounded-full px-4 font-semibold'
            >
              <span className='opacity-80'>{detail.label}</span>
              <bdi className='truncate'>{detail.value}</bdi>
            </button>
          ) : (
            <button
              key={detail.key}
              type='button'
              onClick={() => setEditing(detail.key)}
              className='border-border text-muted-foreground text-note flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4'
            >
              <Plus className='size-3.5' />
              {detail.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
