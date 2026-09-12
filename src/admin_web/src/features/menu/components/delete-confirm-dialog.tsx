import { useT } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemName: string
  isLoading: boolean
  title?: string
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  isLoading,
  title,
}: DeleteConfirmDialogProps) {
  const t = useT()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('deleteItem')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteItemConfirmation', { name: itemName })}{' '}
            {t('cannotBeUndone')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className='bg-destructive hover:bg-destructive/90 text-white'
          >
            {isLoading && <Spinner className='me-2' />}
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
