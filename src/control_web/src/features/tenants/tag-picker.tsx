import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const TAG = /^[A-Za-z0-9._-]{1,64}$/

export const isValidTag = (tag: string) => TAG.test(tag.trim())

type TagPickerProps = {
  /** What the platform knows exists: the default tag, the releases, the tags in use */
  tags: string[]
  /** The release tags among them, marked as such */
  releases: string[]
  /** The tag the tenant stands on, marked as such (absent for a fleet) */
  current?: string
  value: string
  onChange: (tag: string) => void
}

/**
 * A tag is chosen, not typed: the list is what the registry and the tenants
 * say exists, each with a word on what it is. Typing stays possible at the
 * end of the list for the tag nobody has run yet.
 */
export function TagPicker({ tags, releases, current, value, onChange }: TagPickerProps) {
  const t = useT()
  const known = tags.includes(value)
  const [other, setOther] = useState(!known && value !== '')
  const [typed, setTyped] = useState(known ? '' : value)

  const hint = (tag: string) => {
    if (tag === current) return t('tagCurrentHint')
    if (tag === 'latest') return t('tagNewestHint')
    if (releases.includes(tag)) return t('tagReleaseHint')
    return null
  }

  const row = 'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start text-sm transition-colors'
  const dot = (on: boolean) =>
    cn('size-4 shrink-0 rounded-full border-2', on ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_var(--background)]' : 'border-muted-foreground/40')

  return (
    <div role='radiogroup' className='grid gap-1.5'>
      {tags.map((tag) => {
        const on = !other && value === tag
        return (
          <button
            key={tag}
            type='button'
            role='radio'
            aria-checked={on}
            className={cn(row, on ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
            onClick={() => {
              setOther(false)
              onChange(tag)
            }}
          >
            <span className={dot(on)} aria-hidden />
            <span className='font-mono' dir='ltr'>{tag}</span>
            {hint(tag) && <span className='text-muted-foreground ms-auto text-xs'>{hint(tag)}</span>}
          </button>
        )
      })}
      <button
        type='button'
        role='radio'
        aria-checked={other}
        className={cn(row, other ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
        onClick={() => {
          setOther(true)
          onChange(typed.trim())
        }}
      >
        <span className={dot(other)} aria-hidden />
        <span className='text-muted-foreground'>{t('otherTag')}</span>
      </button>
      {other && (
        <Input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            onChange(e.target.value.trim())
          }}
          className='font-mono'
          dir='ltr'
          autoFocus
          aria-label={t('imageTag')}
        />
      )}
    </div>
  )
}
