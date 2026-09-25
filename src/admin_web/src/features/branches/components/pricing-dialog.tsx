import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { type BranchResponse } from '@/api/tenant'
import { type PricingView } from '@/api/sales'
import {
  getBranchPricingOptions,
  setBranchPricingMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

interface PricingDialogProps {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
}

const toPercent = (rate: number | string | undefined) =>
  String(Math.round(Number(rate ?? 0) * 10000) / 100)

/**
 * How this branch's menu prices become the bill: VAT and whether it already
 * sits inside the prices, the service charge on what is served at tables
 * and rooms, and how much a cashier may take off a bill alone. Sales owns
 * these; they apply to tickets settled from now on and never touch a
 * printed receipt.
 */
export function PricingDialog({ branch, onOpenChange }: PricingDialogProps) {
  const t = useT()
  const branchId = Number(branch?.id ?? 0)

  const pricingQuery = useQuery({
    ...getBranchPricingOptions({
      path: { branchId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: branch != null,
  })

  return (
    <Dialog open={branch != null} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Receipt className='h-5 w-5' />
            {t('receiptPricing')}
          </DialogTitle>
        </DialogHeader>
        {/* The form starts from what is saved, so it only mounts once that is known */}
        {pricingQuery.data ? (
          <PricingForm
            key={branchId}
            branchId={branchId}
            pricing={pricingQuery.data}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className='space-y-4 py-2'>
            <Skeleton className='h-9' />
            <Skeleton className='h-9' />
            <Skeleton className='h-9' />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PricingForm({
  branchId,
  pricing,
  onClose,
}: {
  branchId: number
  pricing: PricingView
  onClose: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [vat, setVat] = useState(toPercent(pricing.vatRate))
  const [includesVat, setIncludesVat] = useState(
    pricing.pricesIncludeVat !== false
  )
  const [service, setService] = useState(toPercent(pricing.serviceChargeRate))
  const [cap, setCap] = useState(toPercent(pricing.maxCashierDiscountRate))

  const save = useMutation({
    ...setBranchPricingMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranchPricing' }] })
      toast.success(t('pricingSaved'))
      onClose()
    },
    onError: () => toast.error(t('failedToSavePricing')),
  })

  const submit = () =>
    save.mutate({
      path: { branchId },
      query: { 'api-version': API_VERSION },
      body: {
        vatRate: Number(vat) / 100,
        pricesIncludeVat: includesVat,
        serviceChargeRate: Number(service) / 100,
        maxCashierDiscountRate: Number(cap) / 100,
      },
    })

  return (
    <>
      <div className='space-y-4 py-2'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='vat-rate'>{t('vatRatePercent')}</Label>
            <Input
              id='vat-rate'
              type='number'
              inputMode='decimal'
              min={0}
              max={100}
              step='0.5'
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='service-rate'>{t('serviceChargePercent')}</Label>
            <Input
              id='service-rate'
              type='number'
              inputMode='decimal'
              min={0}
              max={100}
              step='0.5'
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <Label className='text-sm'>{t('pricesIncludeVat')}</Label>
          <Switch checked={includesVat} onCheckedChange={setIncludesVat} />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='cashier-discount-cap'>
            {t('cashierDiscountCap')}
          </Label>
          <Input
            id='cashier-discount-cap'
            type='number'
            inputMode='decimal'
            min={0}
            max={100}
            step='1'
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </DialogFooter>
    </>
  )
}
