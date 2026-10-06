import { Banknote, Bike, Clock, Undo2, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'
import type { BoardLane } from './delivery-board'

/**
 * What the board's chips and columns say of each lane: its words, its icon,
 * and its tint where someone is waiting on the cashier (waiting, coming back,
 * cash to take in)
 */
export const LANE_META: Record<BoardLane, { label: TranslationKey; icon: LucideIcon; tint: string | null; ink: string }> = {
  waiting: {
    label: 'laneWaiting',
    icon: Clock,
    tint: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    ink: 'text-amber-700 dark:text-amber-400',
  },
  withRiders: {
    label: 'laneWithRiders',
    icon: Bike,
    tint: null,
    ink: 'text-muted-foreground',
  },
  comingBack: {
    label: 'laneComingBack',
    icon: Undo2,
    tint: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    ink: 'text-amber-700 dark:text-amber-400',
  },
  cashDue: {
    label: 'laneCashDue',
    icon: Banknote,
    tint: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    ink: 'text-emerald-700 dark:text-emerald-400',
  },
}
