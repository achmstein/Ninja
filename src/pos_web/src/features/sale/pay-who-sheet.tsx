import type { TicketLineView } from '@/api/sales/types.gen'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

/** One payer on a bill: a person and their lines, or the bill's own lines that were for nobody */
export type Payer = { key: string; name: string | null; lineIds: number[]; subtotal: number; summary: TicketLineView[] }

/**
 * Who could pay their own part of this bill: each person something was sent
 * for, and the lines that were nobody's as the bill's own. The room's time is
 * the room's: it is never one person's own, and is paid with the bill's rest.
 * Lines already paid for are done.
 * Fewer than two, and there is nothing to choose between.
 */
export function payersOf(lines: readonly TicketLineView[]): Payer[] {
  const payers: Payer[] = []
  for (const line of lines) {
    // Paid for already, or the room's time: neither is anybody's part to pay now
    if (line.source === 'SessionTime' || line.paid) continue
    const key = line.customerId ? `id:${line.customerId}` : line.customerName ? `name:${line.customerName}` : ''
    let payer = payers.find((p) => p.key === key)
    if (!payer) {
      payer = { key, name: line.customerName || null, lineIds: [], subtotal: 0, summary: [] }
      payers.push(payer)
    }
    payer.lineIds.push(toNumber(line.id))
    payer.subtotal += toNumber(line.total)
    payer.summary.push(line)
  }
  return payers
}

/**
 * "Who is paying?", asked when a bill is more than one person's: everything
 * in one payment, or one person's own part. A part is paid on its own and the
 * bill stays open for the rest.
 */
export function PayWhoSheet({
  open,
  onOpenChange,
  title,
  total,
  payers,
  partPaid = false,
  onEverything,
  onPayer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The bill's own name, said for the lines that were nobody's */
  title: string
  total: number
  payers: Payer[]
  /** Part of the bill is paid already: "everything" is then the rest */
  partPaid?: boolean
  onEverything: () => void
  onPayer: (payer: Payer) => void
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const row = 'hover:bg-muted flex min-h-16 w-full items-center gap-3 border-b px-4 py-3 text-start last:border-b-0 disabled:opacity-50'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {t('payWhoTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className='flex flex-col overflow-hidden rounded-lg border'>
          <button type='button' className={row} onClick={onEverything}>
            <span className='type-heading min-w-0 flex-1'>{partPaid ? t('payTheRest') : t('payEverything')}</span>
            <span className='type-heading shrink-0 tabular-nums'>{money(total)}</span>
          </button>
          {payers.map((payer) => (
            <button key={payer.key} type='button' className={row} onClick={() => onPayer(payer)}>
              <span className='min-w-0 flex-1'>
                <span className='type-heading block truncate'>
                  <bdi>{payer.name ?? title}</bdi>
                </span>
                <span className='text-muted-foreground type-detail block truncate'>
                  {payer.summary.map((line) => `${toNumber(line.qty)}× ${localized(line.description)}`).join(' · ')}
                </span>
              </span>
              <span className='type-body shrink-0 tabular-nums'>{money(payer.subtotal)}</span>
            </button>
          ))}
        </div>
        <p className='text-muted-foreground type-detail'>{t('payWhoHint')}</p>
      </DialogContent>
    </Dialog>
  )
}
