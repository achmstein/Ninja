import type { TicketDetail } from '@/api/sales/types.gen'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

type Row = { label: string; value: string; strong?: boolean; negative?: boolean }

type BreakdownDialogProps = {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  percent: (rate: number | string | undefined) => number
}

/**
 * The bill's parts, one label/value row each, a tap away from the total:
 * menu money, the discount, service, VAT (out of the price or on top), and
 * what has already gone back. The bar itself shows the total only.
 */
export function BreakdownDialog({
  ticket,
  open,
  onOpenChange,
  percent,
}: BreakdownDialogProps) {
  const t = useT()
  const money = useMoney()
  const discount = toNumber(ticket.discount)
  const service = toNumber(ticket.serviceCharge)
  const vat = toNumber(ticket.vat)
  const refunded = toNumber(ticket.refundedTotal)

  const rows: Row[] = [
    { label: t('subtotal'), value: money(ticket.subtotal) },
    ...(discount > 0
      ? [{ label: t('discount'), value: `−${money(ticket.discount)}`, negative: true }]
      : []),
    ...(service > 0
      ? [
          {
            label: t('serviceCharge', { rate: percent(ticket.serviceChargeRate) }),
            value: money(ticket.serviceCharge),
          },
        ]
      : []),
    ...(vat > 0
      ? [
          {
            label: ticket.vatIncluded
              ? t('vatIncluded', { rate: percent(ticket.vatRate) })
              : t('vat', { rate: percent(ticket.vatRate) }),
            value: money(ticket.vat),
          },
        ]
      : []),
    { label: t('total'), value: money(ticket.total), strong: true },
    ...(refunded > 0
      ? [{ label: t('refundedSoFar'), value: `−${money(ticket.refundedTotal)}`, negative: true }]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('breakdown')}</DialogTitle>
        </DialogHeader>
        <div className='divide-y rounded-lg border text-base'>
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn(
                'flex items-baseline justify-between gap-4 px-3 py-2',
                row.strong && 'font-semibold'
              )}
            >
              <span className={cn(!row.strong && 'text-muted-foreground')}>{row.label}</span>
              <span className={cn('tabular-nums', row.negative && 'text-destructive')}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
