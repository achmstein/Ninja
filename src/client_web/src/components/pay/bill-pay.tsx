import { useState } from 'react'
import { CreditCard, Split } from 'lucide-react'
import { type BillView } from '@/api/sales'
import { isOpen } from '@/lib/bills'
import { useFeatures } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import { offersPay } from '@/lib/pay'
import { usePayView, type PaySource } from '@/lib/use-pay'
import { Button } from '@/components/ui/button'
import { PaidSoFar, PayWhy } from './pay-progress'
import { PaySheet, type PayStart } from './pay-sheet'

/**
 * Under an open bill at a table or room, where the café takes payments at
 * the table: paid so far, what is left, and the two ways in — the whole
 * of what is left, or a split. Nothing at all where the café does not
 * offer it, so a guest is never told about a feature they cannot use.
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
    <div className='bg-muted/50 flex flex-col gap-3 rounded-xl p-3'>
      <PaidSoFar view={view} />
      {view.canPay ? (
        <div className='grid grid-cols-2 gap-2'>
          <Button className='rounded-pill font-semibold' onClick={() => openAs('full')}>
            <CreditCard className='h-4 w-4' />
            {t('payFully')}
          </Button>
          <Button
            variant='outline'
            className='rounded-pill font-semibold'
            disabled={!canSplit}
            onClick={() => openAs('split')}
          >
            <Split className='h-4 w-4' />
            {t('splitBill')}
          </Button>
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
      <Button
        variant='outline'
        size='lg'
        className='w-full justify-between rounded-pill font-semibold'
        onClick={() => setOpen(true)}
      >
        <span className='flex items-center gap-2'>
          <CreditCard className='h-4 w-4' />
          {t('payTheBill')}
        </span>
        <span className='text-muted-foreground tabular-nums'>{price(data.remaining)}</span>
      </Button>
      <PaySheet source={source} start='any' open={open} onOpenChange={setOpen} />
    </>
  )
}
