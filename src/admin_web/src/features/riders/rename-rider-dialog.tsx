import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/field'
import { customersService } from '@/features/customers/services/customers-service'
import { refreshRiders } from './refresh'

/**
 * A rider's name, changed on their login: the riders' list and their page
 * say the new one once Ordering hears of it, a moment later.
 */
export function RenameRiderDialog({
  open,
  onOpenChange,
  userId,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  name: string
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(name)

  const rename = useMutation({
    mutationFn: () => customersService.updateName(userId, value.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      refreshRiders(queryClient)
      toast.success(t('riderRenamed'))
      onOpenChange(false)
    },
    onError: () => toast.error(t('riderRenameFailed')),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(name)
        onOpenChange(next)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('riderRename')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim() && value.trim() !== name) rename.mutate()
          }}
          className='space-y-4'
        >
          <Field label={t('name')} htmlFor='riderName'>
            <Input
              id='riderName'
              placeholder={t('enterName')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              disabled={
                rename.isPending || !value.trim() || value.trim() === name
              }
            >
              {rename.isPending && <Spinner />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
