import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot='sheet' {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot='sheet-close' {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot='sheet-portal' {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot='sheet-overlay'
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  // On a phone a sheet from the side rises from the bottom instead, in the
  // thumb's reach, with a handle and room above it to see where it came from
  const isMobile = useIsMobile()
  const placed = side === 'right' && isMobile ? 'bottom' : side
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot='sheet-content'
        data-side={placed}
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-0 overflow-y-auto shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          placed === 'right' &&
            'data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end inset-y-0 end-0 h-full w-full sm:max-w-sm',
          side === 'right' &&
            placed === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-2xl',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start inset-y-0 start-0 h-full w-full border-e sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className
        )}
        {...props}
      >
        {side === 'right' && placed === 'bottom' && (
          <div
            aria-hidden
            className='bg-muted-foreground/30 mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full'
          />
        )}
        {children}
        <SheetPrimitive.Close className='ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute end-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none'>
          <XIcon className='size-4' />
          <span className='sr-only'>Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-header'
      className={cn(
        'border-border/60 flex flex-col gap-1.5 border-b p-5',
        className
      )}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-body'
      className={cn('flex flex-1 flex-col gap-5 p-5', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-footer'
      // The actions stay in reach while the sheet scrolls under them
      className={cn(
        'border-border/60 bg-background/95 sticky bottom-0 mt-auto flex flex-col gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur',
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot='sheet-title'
      className={cn(
        'text-foreground text-lg font-semibold tracking-tight',
        className
      )}
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

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
