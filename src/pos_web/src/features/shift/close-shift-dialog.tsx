import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { closeShiftMutation } from '@/api/sales/@tanstack/react-query.gen'
import type { ShiftView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericKeypad } from '@/components/numeric-keypad'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { useMoney, toNumber } from '@/lib/money'
import { ShiftReport } from './shift-report'
import { ShiftReportSheet } from './shift-report-sheet'

type CloseShiftDialogProps = {
  shift: ShiftView
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Count the drawer and close the shift. The count comes off the keypad
 * (a count of exactly 0 is a valid — if sad — answer, so the cashier must
 * type something before confirming). On success the dialog flips to the
 * frozen Z report from the server: the over/short verdict, the tender
 * split, and every movement — printable on the 80mm roll.
 */
export function CloseShiftDialog({
  shift,
  open,
  onOpenChange,
}: CloseShiftDialogProps) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()
  const [amountStr, setAmountStr] = useState('')
  const [result, setResult] = useState<ShiftView | null>(null)

  useEffect(() => {
    if (!open) {
      setAmountStr('')
      setResult(null)
    }
  }, [open])

  const closeShift = useMutation({
    ...closeShiftMutation(),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getClosedShifts' }] })
      // Closing the shift turned the branch's flags off (through Branch.API)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
      toast.success(t('shiftClosed'))
    },
  })

  const amount = Number(amountStr)
  const canClose =
    amountStr !== '' &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    !closeShift.isPending

  const doClose = () =>
    closeShift.mutate({
      path: { id: toNumber(shift.id) },
      query: { 'api-version': API_VERSION },
      body: { closingCount: amount },
    })

  // ----- Z report view (after closing) -----
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='text-xl'>{t('shiftClosed')}</DialogTitle>
          </DialogHeader>

          <ShiftReport shift={result} />

          <div className='grid grid-cols-2 gap-2'>
            <Button
              variant='outline'
              size='lg'
              className='h-14 text-base'
              onClick={() => onOpenChange(false)}
            >
              {t('done')}
            </Button>
            <Button
              size='lg'
              className='h-14 text-base'
              onClick={() => window.print()}
            >
              <Printer className='size-5' />
              {t('print')}
            </Button>
          </div>

          <ShiftReportSheet shift={result} />
        </DialogContent>
      </Dialog>
    )
  }

  // ----- count entry view -----
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('closeShiftTitle')}</DialogTitle>
        </DialogHeader>

        <div className='bg-accent flex items-center justify-between rounded-lg px-4 py-3'>
          <span className='text-muted-foreground text-sm'>
            {t('expectedInDrawer')}
          </span>
          <span className='text-lg font-bold tabular-nums'>
            {money(shift.expectedInDrawer)}
          </span>
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='closing-count'>{t('countedAmount')}</Label>
          <Input
            id='closing-count'
            readOnly
            inputMode='none'
            value={amountStr}
            placeholder='0'
            dir='ltr'
            className='h-14 text-end text-2xl font-bold tabular-nums'
          />
        </div>

        <NumericKeypad value={amountStr} onChange={setAmountStr} />

        <div className='grid grid-cols-2 gap-2'>
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant='destructive'
            size='lg'
            className='h-12'
            disabled={!canClose}
            onClick={doClose}
          >
            {t('confirmCloseShift')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
