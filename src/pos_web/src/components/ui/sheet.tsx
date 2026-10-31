import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A panel that slides up from the bottom edge — the phone's home for what a
 * tablet shows beside the content (the running order on the sale pad) — or,
 * with `side='end'`, one the whole height of the screen's end side (a
 * search, whose field stays at its top and results fill it). The same Radix
 * dialog underneath, so focus, Escape and scroll-lock behave like
 * every other dialog in the till.
 */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot='sheet' {...props} />
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot='sheet-close' {...props} />
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  side = 'bottom',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean
  side?: 'bottom' | 'end'
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot='sheet-overlay'
        className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50'
      />
      <SheetPrimitive.Content
        data-slot='sheet-content'
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col shadow-lg duration-200',
          'pb-[env(safe-area-inset-bottom)]',
          side === 'bottom'
            ? 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 max-h-[calc(100svh-1rem)] rounded-t-2xl border-t'
            : 'data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end inset-y-0 end-0 h-svh w-full max-w-[480px] border-s',
          className,
        )}
        {...props}
      >
        {/* The grab handle: reads as "this came up from below" */}
        {side === 'bottom' && (
          <div
            aria-hidden
            className='bg-muted-foreground/30 mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full'
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className='ring-offset-background focus-visible:ring-ring absolute end-2 top-3 flex size-11 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden'>
            <XIcon className='size-5' />
            <span className='sr-only'>Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot='sheet-title'
      className={cn('text-lg font-bold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot='sheet-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle }
