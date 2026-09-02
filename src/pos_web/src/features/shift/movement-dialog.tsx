import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCashMovementMutation } from '@/api/sales/@tanstack/react-query.gen'
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

// CashMovementType enum values (Sales.Domain: PayIn=0, PayOut=1)
const MOVEMENT_TYPE = { in: 0, out: 1 } as const

export type MovementDirection = keyof typeof MOVEMENT_TYPE

type MovementDialogProps = {
  shiftId: number
  direction: MovementDirection
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Records cash put into or taken out of the drawer mid-shift (supplier
 * paid from the till, float topped up, ...). Amount comes off the keypad;
 * the reason is required — an unexplained drawer movement is exactly what
 * the Z report exists to catch.
 */
export function MovementDialog({
  shiftId,
  direction,
  open,
  onOpenChange,
}: MovementDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) {
      setAmountStr('')
      setReason('')
    }
  }, [open])

  const addMovement = useMutation({
    ...addCashMovementMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getShift' }] })
      toast.success(t('movementRecorded'))
      onOpenChange(false)
    },
  })

  const amount = Number(amountStr)
  const canSubmit =
    Number.isFinite(amount) &&
    amount > 0 &&
    reason.trim().length > 0 &&
    !addMovement.isPending

  const submit = () =>
    addMovement.mutate({
      path: { id: shiftId },
      query: { 'api-version': API_VERSION },
      body: {
        type: MOVEMENT_TYPE[direction],
        amount,
        reason: reason.trim(),
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {t(direction === 'in' ? 'payIn' : 'payOut')}
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-1.5'>
          <Label htmlFor='movement-amount'>{t('amount')}</Label>
          <Input
            id='movement-amount'
            readOnly
            inputMode='none'
            value={amountStr}
            placeholder='0'
            dir='ltr'
            className='h-14 text-end text-2xl font-bold tabular-nums'
          />
        </div>

        <NumericKeypad value={amountStr} onChange={setAmountStr} />

        <div className='grid gap-1.5'>
          <Label htmlFor='movement-reason'>{t('reason')}</Label>
          <Input
            id='movement-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </div>

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
            disabled={!canSubmit}
            onClick={submit}
          >
            {t(direction === 'in' ? 'payIn' : 'payOut')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
