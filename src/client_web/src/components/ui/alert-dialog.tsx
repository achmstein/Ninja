import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
import { pillAction, pillCancel, SheetFrame, SheetOpen, sheetFooterClass, sheetTitleClass, useSheetRoot } from '@/components/ui/ninja-sheet'

/** A question before something that cannot be undone: the dock's slab rising with the choice (components/ui/ninja-sheet) */
function AlertDialog({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  const root = useSheetRoot(open, defaultOpen, onOpenChange)
  return (
    <SheetOpen.Provider value={root}>
      <AlertDialogPrimitive.Root data-slot='alert-dialog' open={root.open} onOpenChange={root.setOpen} {...props} />
    </SheetOpen.Provider>
  )
}

function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />
}

const parts = {
  Portal: AlertDialogPrimitive.Portal,
  Overlay: AlertDialogPrimitive.Overlay,
  Content: AlertDialogPrimitive.Content,
} as React.ComponentProps<typeof SheetFrame>['parts']

function AlertDialogContent({ className, style, children, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <SheetFrame parts={parts} className={className} style={style} contentProps={{ 'data-slot': 'alert-dialog-content', ...props }}>
      {children}
    </SheetFrame>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='alert-dialog-header' className={cn('flex flex-col gap-1.5 pt-1 text-start', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='alert-dialog-footer' className={cn(sheetFooterClass, className)} {...props} />
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot='alert-dialog-title' className={cn(sheetTitleClass, className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot='alert-dialog-description'
      className={cn('text-muted-foreground text-note', className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action className={cn(pillAction, className)} {...props} />
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cn(pillCancel, className)} {...props} />
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
