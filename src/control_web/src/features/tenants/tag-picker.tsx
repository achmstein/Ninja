import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from '@/lib/i18n'

const TAG = /^[A-Za-z0-9._-]{1,64}$/

export const isValidTag = (tag: string) => TAG.test(tag.trim())

/** The dropdown's value for "a tag nobody has run yet"; not a valid tag, so it can't collide */
const OTHER = '__other__'

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
 * A tag is chosen, not typed: a dropdown of what the registry and the
 * tenants say exists, each with a word on what it is, so the dialog stays
 * the same size however many releases pile up. Typing stays possible under
 * "Other" for the tag nobody has run yet.
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

  const pick = (v: string) => {
    if (v === OTHER) {
      setOther(true)
      onChange(typed.trim())
      return
    }
    setOther(false)
    onChange(v)
  }

  return (
    <div className='grid gap-2'>
      <Select value={other ? OTHER : known ? value : undefined} onValueChange={pick}>
        <SelectTrigger className='w-full' dir='ltr' aria-label={t('imageTag')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className='max-h-72'>
          {tags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              <span className='font-mono' dir='ltr'>
                {tag}
              </span>
              {hint(tag) && <span className='text-muted-foreground ms-2 text-xs'>{hint(tag)}</span>}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>
            <span className='text-muted-foreground'>{t('otherTag')}</span>
          </SelectItem>
        </SelectContent>
      </Select>
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
