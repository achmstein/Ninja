import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bike } from 'lucide-react'
import { type BranchResponse } from '@/api/tenant'
import { updateBranchMutation } from '@/api/tenant/@tanstack/react-query.gen'
import { useCurrencyLabel } from '@/lib/currency'
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
import { Field, FieldGrid } from '@/components/field'
import {
  parseDeliverySettings,
  stopsDelivering,
  type DeliverySettings,
} from '../delivery-settings'

interface DeliveryDialogProps {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
}

const asText = (value: number | string | null | undefined) =>
  value == null || Number(value) === 0 ? '' : String(Number(value))

/**
 * How far this branch's riders go and what a delivery asks: one radius
 * from where the branch is on the map, one fee wherever it goes, and the
 * least the items must come to. Saved with the branch, through the same
 * call its edit form makes.
 */
export function DeliveryDialog({ branch, onOpenChange }: DeliveryDialogProps) {
  const t = useT()

  return (
    <Dialog open={branch != null} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Bike className='h-5 w-5' />
            {t('deliverySettings')}
          </DialogTitle>
        </DialogHeader>
        {branch && (
          <DeliveryForm
            key={String(branch.id)}
            branch={branch}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeliveryForm({
  branch,
  onClose,
}: {
  branch: BranchResponse
  onClose: () => void
}) {
  const t = useT()
  const currency = useCurrencyLabel()
  const queryClient = useQueryClient()
  const [radius, setRadius] = useState(asText(branch.deliveryRadiusKm))
  const [fee, setFee] = useState(asText(branch.deliveryFee))
  const [minimum, setMinimum] = useState(asText(branch.deliveryMinimumOrder))
  const [tried, setTried] = useState(false)
  // Clearing the radius of a branch that delivers stops it: asked once more
  const [confirming, setConfirming] = useState(false)

  const parsed = parseDeliverySettings({ radius, fee, minimum })
  const errors = tried && !parsed.ok ? parsed.errors : {}

  const save = useMutation({
    ...updateBranchMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllBranches' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
      toast.success(t('branchUpdatedSuccess'))
      onClose()
    },
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  const submit = () => {
    setTried(true)
    if (!parsed.ok) return
    if (!confirming && stopsDelivering(branch.isDeliveryEnabled, parsed.value)) {
      setConfirming(true)
      return
    }
    send(parsed.value)
  }

  // The branch goes back as it is, with only how it delivers changed
  const send = (value: DeliverySettings) =>
    save.mutate({
      path: { id: Number(branch.id) },
      body: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        taxNumber: branch.taxNumber,
        receiptFooter: branch.receiptFooter,
        isActive: branch.isActive,
        displayOrder: branch.displayOrder,
        dayStartTime: branch.dayStartTime,
        deliveryRadiusKm: value.radius,
        deliveryFee: value.fee,
        deliveryMinimumOrder: value.minimum,
      },
    })

  return (
    <>
      <div className='space-y-4 py-2'>
        <Field
          label={t('deliveryRadiusKm')}
          htmlFor='delivery-radius'
          hint={t('deliveryRadiusHint')}
          error={
            errors.radius ? (
              <span id='delivery-radius-error'>{t('deliveryRadiusInvalid')}</span>
            ) : undefined
          }
        >
          <Input
            id='delivery-radius'
            type='number'
            inputMode='decimal'
            min={0}
            max={100}
            step='0.5'
            value={radius}
            aria-invalid={errors.radius || undefined}
            aria-describedby={errors.radius ? 'delivery-radius-error' : undefined}
            onChange={(e) => {
              setRadius(e.target.value)
              setConfirming(false)
            }}
          />
        </Field>
        <FieldGrid>
          <Field
            label={`${t('deliveryFee')} (${currency})`}
            htmlFor='delivery-fee'
            error={
              errors.fee ? (
                <span id='delivery-fee-error'>{t('deliveryAmountInvalid')}</span>
              ) : undefined
            }
          >
            <Input
              id='delivery-fee'
              type='number'
              inputMode='decimal'
              min={0}
              step='1'
              placeholder='0'
              value={fee}
              aria-invalid={errors.fee || undefined}
              aria-describedby={errors.fee ? 'delivery-fee-error' : undefined}
              onChange={(e) => setFee(e.target.value)}
            />
          </Field>
          <Field
            label={`${t('deliveryMinimumOrder')} (${currency})`}
            htmlFor='delivery-minimum'
            error={
              errors.minimum ? (
                <span id='delivery-minimum-error'>
                  {t('deliveryAmountInvalid')}
                </span>
              ) : undefined
            }
          >
            <Input
              id='delivery-minimum'
              type='number'
              inputMode='decimal'
              min={0}
              step='1'
              placeholder='0'
              value={minimum}
              aria-invalid={errors.minimum || undefined}
              aria-describedby={
                errors.minimum ? 'delivery-minimum-error' : undefined
              }
              onChange={(e) => setMinimum(e.target.value)}
            />
          </Field>
        </FieldGrid>
        {confirming && (
          <p
            role='alert'
            className='rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400'
          >
            {t('deliveryClearRadiusConfirm')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={save.isPending}
          variant={confirming ? 'destructive' : 'default'}
        >
          {save.isPending && <Spinner />}
          {confirming ? t('deliveryStopDelivering') : t('save')}
        </Button>
      </DialogFooter>
    </>
  )
}
