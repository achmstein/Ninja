import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { openShiftMutation } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericKeypad } from '@/components/numeric-keypad'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

type OpenShiftDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Opens the branch's drawer shift with the counted opening float. The
 * keypad is the only way to type the amount (no OS keyboard on the till);
 * a float of exactly 0 is legitimate, so the cashier must type something —
 * even a bare 0 — before confirming.
 */
export function OpenShiftDialog({ open, onOpenChange }: OpenShiftDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [amountStr, setAmountStr] = useState('')

  useEffect(() => {
    if (!open) setAmountStr('')
  }, [open])

  const openShift = useMutation({
    ...openShiftMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      // Opening the shift turned the branch's taking-orders / reservations
      // flags on (through Branch.API)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
      toast.success(t('shiftOpened'))
      onOpenChange(false)
      navigate({ to: '/shift' })
    },
  })

  const amount = Number(amountStr)
  const canOpen =
    amountStr !== '' &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    !openShift.isPending

  const doOpen = () =>
    openShift.mutate({
      query: { 'api-version': API_VERSION },
      body: { openingFloat: amount },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('openShiftTitle')}</DialogTitle>
        </DialogHeader>

        <div className='grid gap-1.5'>
          <Label htmlFor='opening-float'>{t('openingFloat')}</Label>
          <Input
            id='opening-float'
            readOnly
            inputMode='none'
            value={amountStr}
            placeholder='0'
            dir='ltr'
            className='h-14 text-end text-2xl font-bold tabular-nums'
          />
        </div>

        <NumericKeypad value={amountStr} onChange={setAmountStr} />

        <DialogFooter className='gap-2'>
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            size='lg'
            className='h-12'
            disabled={!canOpen}
            onClick={doOpen}
          >
            {t('openShiftAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
