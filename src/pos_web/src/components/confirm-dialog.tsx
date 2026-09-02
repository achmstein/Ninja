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
