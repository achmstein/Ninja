import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SheetFrame, SheetOpen, sheetFooterClass, sheetTitleClass, useSheetRoot } from '@/components/ui/ninja-sheet'

/** A dialog, as every sheet in the app is: the dock's slab rising out of the dock (components/ui/ninja-sheet) */
function Dialog({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const root = useSheetRoot(open, defaultOpen, onOpenChange)
  return (
    <SheetOpen.Provider value={root}>
      <DialogPrimitive.Root data-slot='dialog' open={root.open} onOpenChange={root.setOpen} {...props} />
    </SheetOpen.Provider>
  )
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot='dialog-close' {...props} />
}

export const dialogParts = {
  Portal: DialogPrimitive.Portal,
  Overlay: DialogPrimitive.Overlay,
  Content: DialogPrimitive.Content,
} as React.ComponentProps<typeof SheetFrame>['parts']

/** The round way out at the sheet's top end */
export function SheetCloseButton() {
  return (
    <DialogPrimitive.Close
      data-slot='dialog-close'
      className='bg-muted text-foreground absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-full transition-transform active:scale-95 motion-reduce:transform-none'
    >
      <XIcon className='size-4' />
      <span className='sr-only'>Close</span>
    </DialogPrimitive.Close>
  )
}

function DialogContent({
  className,
  style,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <SheetFrame parts={dialogParts} className={className} style={style} contentProps={{ 'data-slot': 'dialog-content', ...props }}>
      {children}
      {showCloseButton && <SheetCloseButton />}
    </SheetFrame>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='dialog-header' className={cn('flex flex-col gap-1.5 pe-10 text-start', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='dialog-footer' className={cn(sheetFooterClass, className)} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot='dialog-title' className={cn(sheetTitleClass, className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot='dialog-description' className={cn('text-muted-foreground text-[15px]', className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
