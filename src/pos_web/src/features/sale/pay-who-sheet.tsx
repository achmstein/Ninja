import { Loader2 } from 'lucide-react'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

/** One payer on a bill: a person and their lines, or the bill's own lines that were for nobody */
export type Payer = { key: string; name: string | null; lineIds: number[]; subtotal: number; summary: TicketLineView[] }

/**
 * Who could pay their own part of this bill: each person something was sent
 * for, and the lines that were nobody's as the bill's own. The room's time is
 * the room's: it is never one person's to carry off, and stays with the bill.
 * Fewer than two, and there is nothing to choose between.
 */
export function payersOf(lines: readonly TicketLineView[]): Payer[] {
  const payers: Payer[] = []
  for (const line of lines) {
    if (line.source === 'SessionTime') continue
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
 * in one payment, or one person's own part. A part is paid as a bill of its
 * own, split off the moment it is picked, and the rest stays open.
 */
export function PayWhoSheet({
  open,
  onOpenChange,
  title,
  total,
  payers,
  busy,
  onEverything,
  onPayer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The bill's own name, said for the lines that were nobody's */
  title: string
  total: number
  payers: Payer[]
  /** A part is being split off */
  busy: boolean
  onEverything: () => void
  onPayer: (payer: Payer) => void
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const row = 'hover:bg-muted flex min-h-16 w-full items-center gap-3 border-b px-4 py-3 text-start last:border-b-0 disabled:opacity-50'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {t('payWhoTitle')}
            {busy && <Loader2 className='size-4 animate-spin' aria-hidden />}
          </DialogTitle>
        </DialogHeader>
        <div className='flex flex-col overflow-hidden rounded-lg border'>
          <button type='button' className={row} disabled={busy} onClick={onEverything}>
            <span className='min-w-0 flex-1 text-base font-semibold'>{t('payEverything')}</span>
            <span className='shrink-0 text-base font-semibold tabular-nums'>{money(total)}</span>
          </button>
          {payers.map((payer) => (
            <button key={payer.key} type='button' className={row} disabled={busy} onClick={() => onPayer(payer)}>
              <span className='min-w-0 flex-1'>
                <bdi className='block truncate text-base font-semibold'>{payer.name ?? title}</bdi>
                <span className='text-muted-foreground block truncate text-sm'>
                  {payer.summary.map((line) => `${toNumber(line.qty)}× ${localized(line.description)}`).join(' · ')}
                </span>
              </span>
              <span className='shrink-0 text-base tabular-nums'>{money(payer.subtotal)}</span>
            </button>
          ))}
        </div>
        <p className='text-muted-foreground text-sm'>{t('payWhoHint')}</p>
      </DialogContent>
    </Dialog>
  )
}
