import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { type BranchResponse } from '@/api/branch'
import {
  getBranchPricingOptions,
  setBranchPricingMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
 * sits inside the prices, and the service charge on what is served at
 * tables and rooms. Sales owns these; they apply to tickets settled from
 * now on and never touch a printed receipt.
 */
export function PricingDialog({ branch, onOpenChange }: PricingDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const branchId = Number(branch?.id ?? 0)

  const pricingQuery = useQuery({
    ...getBranchPricingOptions({
      path: { branchId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: branch != null,
  })

  const [vat, setVat] = useState('0')
  const [includesVat, setIncludesVat] = useState(true)
  const [service, setService] = useState('0')

  useEffect(() => {
    const pricing = pricingQuery.data
    if (!pricing) return
    setVat(toPercent(pricing.vatRate))
    setIncludesVat(pricing.pricesIncludeVat !== false)
    setService(toPercent(pricing.serviceChargeRate))
  }, [pricingQuery.data])

  const save = useMutation({
    ...setBranchPricingMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranchPricing' }] })
      toast.success(t('pricingSaved'))
      onOpenChange(false)
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
      },
    })

  return (
    <Dialog open={branch != null} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[420px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Receipt className='h-5 w-5' />
            {t('receiptPricing')}
          </DialogTitle>
          <DialogDescription>
            {t('receiptPricingDescription', { name: localized(branch?.name) })}
          </DialogDescription>
        </DialogHeader>

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

          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label className='text-sm'>{t('pricesIncludeVat')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('pricesIncludeVatHint')}
              </p>
            </div>
            <Switch checked={includesVat} onCheckedChange={setIncludesVat} />
          </div>

          <p className='text-muted-foreground text-xs'>
            {t('serviceChargeHint')}
          </p>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending || pricingQuery.isLoading}
          >
            {save.isPending && <Spinner className='me-2' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
