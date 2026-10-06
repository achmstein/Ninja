import { useNavigate } from '@tanstack/react-router'
import { Bike, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { BOARD_LANES, byLane } from './delivery-board'
import { LANE_META } from './lane-meta'
import { useDeliveries } from './use-deliveries'

/**
 * The deliveries on the floor in one row, however many there are: how many
 * in each lane (the ones waiting on the cashier tinted) and the cash still
 * out, a tap from the board where they are worked. Gone when nothing is out,
 * so the floor keeps its room on a quiet day.
 */
export function DeliveriesSummary() {
  const t = useT()
  const money = useMoney()
  const navigate = useNavigate()
  const rtl = useLanguage((s) => s.language) === 'ar'
  const { deliveries } = useDeliveries()
  const lanes = byLane(deliveries)
  const total = BOARD_LANES.reduce((sum, lane) => sum + lanes[lane].length, 0)
  if (total === 0) return null
  const cash = lanes.cashDue.reduce((sum, o) => sum + toNumber(o.total), 0)
  const Chevron = rtl ? ChevronLeft : ChevronRight

  return (
    <button
      type='button'
      onClick={() => navigate({ to: '/deliveries' })}
      aria-label={`${t('deliveries')}, ${total}`}
      className='hover:bg-muted/50 flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-colors'
    >
      <Bike className='text-primary size-5 shrink-0' aria-hidden />
      <span className='shrink-0 text-lg font-semibold'>{t('deliveries')}</span>
      {/* The lanes scroll sideways on a narrow till rather than wrap the row */}
      <span className='flex min-w-0 flex-1 gap-2 overflow-x-auto'>
        {BOARD_LANES.map((lane) => {
          const count = lanes[lane].length
          const meta = LANE_META[lane]
          const Icon = meta.icon
          return (
            <span
              key={lane}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums',
                count > 0 && meta.tint ? meta.tint : 'bg-secondary',
                count === 0 && 'text-muted-foreground',
              )}
            >
              <Icon className='size-4' aria-hidden />
              {t(meta.label)} {count}
              {lane === 'cashDue' && count > 0 && <> · {money(cash)}</>}
            </span>
          )
        })}
      </span>
      <Chevron className='text-muted-foreground size-5 shrink-0' aria-hidden />
    </button>
  )
}
