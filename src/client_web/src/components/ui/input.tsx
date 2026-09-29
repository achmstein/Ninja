import * as React from 'react'
import { revealField } from '@/lib/reveal'
import { cn } from '@/lib/utils'

/**
 * A field in the Ninja style: filled, not outlined, a finger's height, the
 * corners of the pills around it. 16 px text, below which a phone zooms in.
 * Focused, it scrolls itself clear of the keyboard coming up.
 */
export const fieldClass =
  'bg-muted placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 rounded-2xl px-4 text-base transition-shadow outline-none focus-visible:ring-primary/40 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/50 aria-invalid:ring-2'

function Input({ className, type, onFocus, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot='input'
      onFocus={(e) => {
        revealField(e.currentTarget)
        onFocus?.(e)
      }}
      className={cn(fieldClass, 'flex h-12', className)}
      {...props}
    />
  )
}

export { Input }
