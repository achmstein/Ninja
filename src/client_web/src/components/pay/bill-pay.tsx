import { useState } from 'react'
import { CreditCard, Split } from 'lucide-react'
import { type BillView } from '@/api/sales'
import { isOpen } from '@/lib/bills'
import { useFeatures } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import { offersPay } from '@/lib/pay'
import { usePayView, type PaySource } from '@/lib/use-pay'
import { Odometer } from '@/components/ninja/odometer'
import { PaidSoFar, PayWhy } from './pay-progress'
import { PaySheet, type PayStart } from './pay-sheet'

/**
 * Under an open bill at a table or room, where the café takes payments at
 * the table: paid so far, what is left, and the two ways in — the whole
 * of what is left, or a split. Nothing at all where the café does not
 * offer it, so a guest is never told about a feature they cannot use.
 * It reads on its own as a light card, and tucked under the bill's slab
 * as the slab's lower lip.
 */
export function BillPayBar({ bill }: { bill: BillView }) {
  const features = useFeatures()
  const shown = features.onlinePayments && isOpen(bill) && bill.placeId != null
  const source = { ticketId: Number(bill.id) }
  const view = usePayView(source, { enabled: shown })
  const data = view.data
  if (!shown || !data || !offersPay(data.why)) return null
  return <PayBar source={source} view={data} />
}

function PayBar({
  source,
  view,
}: {
  source: PaySource
  view: NonNullable<ReturnType<typeof usePayView>['data']>
}) {
  const t = useT()
  // The way in stays put while the sheet slides away
  const [start, setStart] = useState<PayStart>('full')
  const [open, setOpen] = useState(false)
  const openAs = (way: PayStart) => {
    setStart(way)
    setOpen(true)
  }
  const canSplit =
    view.options.allowItems || view.options.allowEqual || view.options.allowCustom

  return (
    <div className='bg-muted flex flex-col gap-3 rounded-[1.5rem] p-4'>
      <PaidSoFar view={view} />
      {view.canPay ? (
        <div className='grid grid-cols-2 gap-2'>
          <button
            type='button'
            onClick={() => openAs('full')}
            className='bg-foreground text-background flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold transition-transform active:scale-[0.97] motion-reduce:transform-none'
          >
            <CreditCard className='size-4' />
            {t('payFully')}
          </button>
          <button
            type='button'
            disabled={!canSplit}
            onClick={() => openAs('split')}
            className='bg-background flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold transition-transform active:scale-[0.97] disabled:opacity-50 motion-reduce:transform-none'
          >
            <Split className='size-4' />
            {t('splitBill')}
          </button>
        </div>
      ) : (
        <PayWhy why={view.why} className='bg-background' />
      )}
      <PaySheet
        source={source}
        start={start}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

/**
 * The table's own way in, on the table sheet: whatever is open at this
 * table, for a guest sitting at it who ordered nothing themselves (a friend
 * paying for the round). Read once when the sheet opens; the pay sheet
 * keeps itself live.
 */
export function TablePayButton({ placeId, branchId }: { placeId: number; branchId: number }) {
  const t = useT()
  const price = usePrice()
  const features = useFeatures()
  const [open, setOpen] = useState(false)
  const source = { placeId, branchId }
  const view = usePayView(source, { enabled: features.onlinePayments, live: open })
  const data = view.data
  if (!features.onlinePayments || !data || !offersPay(data.why) || data.why === 'closed' || data.why === 'empty')
    return null

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='bg-muted flex h-12 w-full items-center justify-between gap-2 rounded-full ps-5 pe-4 font-semibold transition-transform active:scale-[0.98] motion-reduce:transform-none'
      >
        <span className='flex items-center gap-2'>
          <CreditCard className='size-4' />
          {t('payTheBill')}
        </span>
        <Odometer value={price(data.remaining)} className='text-muted-foreground text-[15px]' />
      </button>
      <PaySheet source={source} start='any' open={open} onOpenChange={setOpen} />
    </>
  )
}
