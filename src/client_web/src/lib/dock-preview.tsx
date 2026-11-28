import { create } from 'zustand'
import { accountPreview } from '@/components/auth/phone-gate'
import { type PillStage } from '@/lib/order-pill'
import { cn } from '@/lib/utils'

/**
 * The dock's proposed changes, tried in the real app: a development build
 * with `?preview-account` only (the same switch as the account by phone).
 * Its states come from a small panel in the page's corner instead of a real
 * order, so each can be looked at without placing one: an order moving
 * through its stages, with or without an unsent order in the tray, and a
 * waiter asked for. (Offering the customer's usual on an idle dock was tried
 * and dropped: the owner's view is that they already know what they have.) A production build never has any of it.
 */
export const useDockPreview = create<{
  on: boolean
  /** The stage the panel put the order at; null for no order on its way */
  stage: PillStage | null
  /** The waiter was asked for */
  waiter: boolean
}>(() => ({ on: accountPreview(), stage: null, waiter: false }))

/** About how many minutes are left at each stage, for the row's headline */
export const PREVIEW_MINUTES: Partial<Record<PillStage, number>> = { confirmed: 12, preparing: 8, onTheWay: 4 }

/** How far along the order is, as a share of the line across the dock's top */
export const STAGE_PROGRESS: Partial<Record<PillStage, number>> = {
  sent: 0.12,
  confirmed: 0.32,
  preparing: 0.6,
  onTheWay: 0.85,
  delivered: 1,
  paid: 1,
}

const STAGES: Array<[PillStage | null, string]> = [
  [null, 'No order'],
  ['sent', 'Sent'],
  ['confirmed', 'Confirmed'],
  ['preparing', 'Being made'],
  ['onTheWay', 'On its way'],
  ['delivered', 'Delivered'],
]

/** The panel that sets the dock's state in the preview: not part of the app's own screens */
export function DockPreviewPanel() {
  const { on, stage, waiter } = useDockPreview()
  if (!on) return null
  const chip = 'rounded-full px-2.5 py-1 text-[11px] font-semibold'
  return (
    <div dir='ltr' className='fixed start-2 top-2 z-[300] flex max-w-[15rem] flex-col gap-1.5 rounded-2xl bg-amber-50 p-2 text-amber-950 shadow-lg ring-1 ring-amber-300'>
      <span className='px-1 text-[11px] font-bold'>Preview: the order</span>
      <div className='flex flex-wrap gap-1'>
        {STAGES.map(([value, label]) => (
          <button
            key={label}
            type='button'
            onClick={() => useDockPreview.setState({ stage: value })}
            className={cn(chip, stage === value ? 'bg-amber-900 text-amber-50' : 'bg-amber-200')}
          >
            {label}
          </button>
        ))}
      </div>
      <button type='button' onClick={() => useDockPreview.setState({ waiter: !waiter })} className={cn(chip, 'self-start', waiter ? 'bg-amber-900 text-amber-50' : 'bg-amber-200')}>
        Waiter asked for
      </button>
    </div>
  )
}
