import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel: string
  actionLabel: string
  /** Paint the action red: something ends, or money-relevant state changes. */
  destructive?: boolean
  disabled?: boolean
  onAction: () => void
  /**
   * A third answer, quieter than the other two and kept apart from them on
   * the start side: the rare outcome of the same decision (end the session,
   * or cancel it without charging). Both must be given, or neither.
   */
  secondaryLabel?: string
  onSecondary?: () => void
}

/**
 * One question, two big buttons. The till's answer to every "are you sure":
 * a thumb-sized cancel on the start side, the action on the end side, and
 * the dialog closes itself before the action runs.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  actionLabel,
  destructive = false,
  disabled = false,
  onAction,
  secondaryLabel,
  onSecondary,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{title}</DialogTitle>
          <DialogDescription className='text-base'>
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className='gap-2'>
          {secondaryLabel && onSecondary && (
            <Button
              variant='ghost'
              size='lg'
              className='text-destructive hover:text-destructive h-12 sm:me-auto'
              disabled={disabled}
              onClick={() => {
                onOpenChange(false)
                onSecondary()
              }}
            >
              {secondaryLabel}
            </Button>
          )}
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size='lg'
            className='h-12'
            disabled={disabled}
            onClick={() => {
              onOpenChange(false)
              onAction()
            }}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
