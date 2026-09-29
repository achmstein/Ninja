import * as React from 'react'
import { revealField } from '@/lib/reveal'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

function Textarea({ className, onFocus, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      onFocus={(e) => {
        revealField(e.currentTarget)
        onFocus?.(e)
      }}
      className={cn(fieldClass, 'flex field-sizing-content min-h-20 py-3', className)}
      {...props}
    />
  )
}

export { Textarea }
