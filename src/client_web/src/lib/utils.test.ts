import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a type scale size beside a colour', () => {
    expect(cn('text-note', 'text-muted-foreground')).toBe('text-note text-muted-foreground')
    expect(cn('text-title', 'text-primary-foreground')).toBe('text-title text-primary-foreground')
  })

  it('lets a later size win over an earlier one', () => {
    expect(cn('text-note', 'text-caption')).toBe('text-caption')
  })
})
