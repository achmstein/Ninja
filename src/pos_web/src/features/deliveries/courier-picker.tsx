import { useState } from 'react'
import { Check, Truck } from 'lucide-react'
import type { CourierProviderView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCourierProviders, useDeliveryActions, type BoardDelivery } from './use-deliveries'

/**
 * The courier companies after the branch's riders: a manual courier, told by
 * phone. Picking one asks who the company sent (when it said) and its fee for
 * this delivery, the company's usual one filled in; the company that has it
 * now opens with what was said, to put it right. Nothing shows when the
 * business lists none.
 */
export function CourierPicker({ order, enabled }: { order: BoardDelivery; enabled: boolean }) {
  const t = useT()
  const money = useMoney()
  const providers = useCourierProviders(enabled)
  const actions = useDeliveryActions()
  const d = order.delivery
  const current = d.courierProviderId == null ? null : toNumber(d.courierProviderId)
  const [open, setOpen] = useState<number | null>(null)
  const list = providers.data ?? []
  if (list.length === 0) return null

  return (
    <div className='flex flex-col gap-2'>
      <span className='text-muted-foreground type-detail font-medium'>{t('deliveryCouriers')}</span>
      {list.map((provider) => {
        const id = toNumber(provider.id)
        const fee = provider.defaultFee == null ? null : toNumber(provider.defaultFee)
        return open === id ? (
          <CourierForm
            key={id}
            provider={provider}
            initial={
              current === id
                ? { courierName: d.courierName ?? '', courierPhone: d.courierPhone ?? '', fee: d.courierFee == null ? fee : toNumber(d.courierFee) }
                : { courierName: '', courierPhone: '', fee }
            }
            busy={actions.busy}
            onCancel={() => setOpen(null)}
            onGive={(courier) => {
              actions.assignCourier(toNumber(order.orderNumber), { providerId: id, ...courier })
              setOpen(null)
            }}
          />
        ) : (
          <button
            key={id}
            type='button'
            disabled={actions.busy || (provider.isConnected && current === id)}
            // A connected company's own system says who it sends and its fee: nothing to ask
            onClick={() =>
              provider.isConnected ? actions.assignCourier(toNumber(order.orderNumber), { providerId: id }) : setOpen(id)
            }
            aria-pressed={current === id}
            className={cn(
              'flex h-14 items-center gap-3 rounded-lg border px-3 text-start transition-colors',
              current === id ? 'border-primary bg-primary/5' : 'hover:bg-muted',
            )}
          >
            <Truck className='size-5' aria-hidden />
            <span className='min-w-0 flex-1'>
              <span className='block truncate font-medium'>
                <bdi>{provider.name}</bdi>
              </span>
              {provider.isConnected && current !== id ? (
                <span className='text-muted-foreground block type-caption'>{t('deliveryCourierConnected')}</span>
              ) : (current === id ? d.courierName : null) || fee != null ? (
                <span className='text-muted-foreground block type-caption'>
                  {current === id && d.courierName ? <bdi>{d.courierName}</bdi> : null}
                  {current === id && d.courierName && fee != null ? ' · ' : null}
                  {fee != null ? t('deliveryCourierFeeLine', { amount: money(current === id && d.courierFee != null ? d.courierFee : fee) }) : null}
                </span>
              ) : null}
            </span>
            {current === id && <Check className='text-primary size-5' aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

type Courier = { courierName: string; courierPhone: string; fee: number | null }

function CourierForm({
  provider,
  initial,
  busy,
  onCancel,
  onGive,
}: {
  provider: CourierProviderView
  initial: Courier
  busy: boolean
  onCancel: () => void
  onGive: (courier: Courier) => void
}) {
  const t = useT()
  const [courierName, setCourierName] = useState(initial.courierName)
  const [courierPhone, setCourierPhone] = useState(initial.courierPhone)
  const [fee, setFee] = useState(initial.fee == null ? '' : String(initial.fee))
  const feeValue = fee.trim() === '' ? null : Number(fee.replace(',', '.'))
  const feeOk = feeValue == null || (Number.isFinite(feeValue) && feeValue >= 0)
  const id = toNumber(provider.id)

  return (
    <form
      className='border-primary flex flex-col gap-2.5 rounded-lg border p-3'
      onSubmit={(e) => {
        e.preventDefault()
        if (feeOk) onGive({ courierName, courierPhone, fee: feeValue })
      }}
    >
      <span className='flex items-center gap-2 font-medium'>
        <Truck className='size-4' aria-hidden />
        <bdi>{provider.name}</bdi>
      </span>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`courier-name-${id}`}>{t('deliveryCourierName')}</Label>
        <Input id={`courier-name-${id}`} value={courierName} onChange={(e) => setCourierName(e.target.value)} maxLength={200} autoComplete='off' className='h-11' />
      </div>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`courier-phone-${id}`}>{t('deliveryCourierPhone')}</Label>
        <Input
          id={`courier-phone-${id}`}
          value={courierPhone}
          onChange={(e) => setCourierPhone(e.target.value)}
          maxLength={30}
          inputMode='tel'
          dir='ltr'
          autoComplete='off'
          className='h-11'
        />
      </div>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`courier-fee-${id}`}>{t('deliveryCourierFee')}</Label>
        <Input
          id={`courier-fee-${id}`}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          inputMode='decimal'
          dir='ltr'
          autoComplete='off'
          aria-invalid={!feeOk}
          className='h-11 tabular-nums'
        />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Button type='button' variant='outline' className='h-11' disabled={busy} onClick={onCancel}>
          {t('goBack')}
        </Button>
        <Button type='submit' className='h-11' disabled={busy || !feeOk}>
          {t('deliveryCourierGive', { name: provider.name ?? '' })}
        </Button>
      </div>
    </form>
  )
}
