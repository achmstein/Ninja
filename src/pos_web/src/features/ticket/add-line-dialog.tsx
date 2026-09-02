import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addTicketLineMutation } from '@/api/sales/@tanstack/react-query.gen'
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
import { cn } from '@/lib/utils'

type NumericField = 'qty' | 'unitPrice' | 'discount'

type AddLineDialogProps = {
  ticketId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manual line entry (phase 1 has no item pad yet — every counter sale is a
 * typed description plus keypad numbers). The three amount fields share one
 * keypad: tap a field to make it the target; the OS keyboard stays away
 * (readOnly inputs).
 */
export function AddLineDialog({
  ticketId,
  open,
  onOpenChange,
}: AddLineDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [descriptionEn, setDescriptionEn] = useState('')
  const [descriptionAr, setDescriptionAr] = useState('')
  const [amounts, setAmounts] = useState<Record<NumericField, string>>({
    qty: '1',
    unitPrice: '',
    discount: '',
  })
  const [activeField, setActiveField] = useState<NumericField>('unitPrice')

  const reset = () => {
    setDescriptionEn('')
    setDescriptionAr('')
    setAmounts({ qty: '1', unitPrice: '', discount: '' })
    setActiveField('unitPrice')
  }

  const addLine = useMutation({
    ...addTicketLineMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      toast.success(t('lineAdded'))
      reset()
      onOpenChange(false)
    },
  })

  const qty = Number(amounts.qty)
  const unitPrice = Number(amounts.unitPrice)
  const discount = Number(amounts.discount || '0')
  const canSubmit =
    descriptionEn.trim().length > 0 &&
    Number.isFinite(qty) &&
    qty > 0 &&
    Number.isFinite(unitPrice) &&
    unitPrice > 0 &&
    Number.isFinite(discount) &&
    discount >= 0

  const submit = () =>
    addLine.mutate({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
      body: {
        description: {
          en: descriptionEn.trim(),
          ar: descriptionAr.trim() || null,
        },
        qty,
        unitPrice,
        discount,
      },
    })

  const numericInput = (field: NumericField, labelKey: Parameters<typeof t>[0]) => (
    <div className='grid gap-1.5'>
      <Label htmlFor={`line-${field}`}>{t(labelKey)}</Label>
      <Input
        id={`line-${field}`}
        readOnly
        inputMode='none'
        value={amounts[field]}
        onFocus={() => setActiveField(field)}
        onClick={() => setActiveField(field)}
        dir='ltr'
        className={cn(
          'h-12 text-lg tabular-nums',
          activeField === field && 'border-ring ring-ring/50 ring-[3px]'
        )}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('addLineTitle')}</DialogTitle>
        </DialogHeader>

        <div className='grid gap-1.5'>
          <Label htmlFor='line-description-en'>{t('descriptionEn')}</Label>
          <Input
            id='line-description-en'
            dir='ltr'
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='line-description-ar'>
            {t('descriptionAr')}{' '}
            <span className='text-muted-foreground font-normal'>
              ({t('optional')})
            </span>
          </Label>
          <Input
            id='line-description-ar'
            dir='rtl'
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </div>

        <div className='grid grid-cols-3 gap-2'>
          {numericInput('qty', 'qty')}
          {numericInput('unitPrice', 'unitPrice')}
          {numericInput('discount', 'discount')}
        </div>

        <NumericKeypad
          value={amounts[activeField]}
          onChange={(value) =>
            setAmounts((prev) => ({ ...prev, [activeField]: value }))
          }
        />

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
            disabled={!canSubmit || addLine.isPending}
            onClick={submit}
          >
            {t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
