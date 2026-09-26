import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { dialogParts, SheetCloseButton } from '@/components/ui/dialog'
import { SheetFrame, SheetOpen, sheetTitleClass, useSheetRoot } from '@/components/ui/ninja-sheet'

/**
 * A sheet: the dock's slab rising out of the dock, or, for one opened from
 * the top bar (`side='top'`), dropping from the bar (components/ui/ninja-sheet).
 */
function Sheet({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const root = useSheetRoot(open, defaultOpen, onOpenChange)
  return (
    <SheetOpen.Provider value={root}>
      <SheetPrimitive.Root data-slot='sheet' open={root.open} onOpenChange={root.setOpen} {...props} />
    </SheetOpen.Provider>
  )
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot='sheet-close' {...props} />
}

function SheetContent({
  className,
  style,
  children,
  side = 'bottom',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'top' | 'bottom' }) {
  return (
    <SheetFrame
      parts={dialogParts}
      from={side}
      className={className}
      style={style}
      contentProps={{ 'data-slot': 'sheet-content', ...props }}
    >
      {children}
      <SheetCloseButton />
    </SheetFrame>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='sheet-header' className={cn('flex flex-col gap-1.5 pe-10 text-start', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='sheet-footer' className={cn('mt-auto flex flex-col gap-2', className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot='sheet-title' className={cn(sheetTitleClass, className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot='sheet-description' className={cn('text-muted-foreground text-[15px]', className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
