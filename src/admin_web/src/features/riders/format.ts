import { type TranslationKey } from '@/lib/i18n'
import { type ChipTone } from '@/components/status-chip'

/** Where a rider stands now, as Ordering says it */
export type RiderPresence = 'Online' | 'Quiet' | 'Off'

/** A history row's stage: the delivery's own while it stayed theirs, or how it left them */
export type RiderStage =
  | 'Assigned'
  | 'OnTheWay'
  | 'Delivered'
  | 'Failed'
  | 'Returned'
  | 'TakenBack'
  | 'GivenToOther'

/** One step of a delivery's history */
export type DeliveryAction =
  | 'Assigned'
  | 'Unassigned'
  | 'Reassigned'
  | 'Out'
  | 'Delivered'
  | 'Failed'
  | 'Returned'
  | 'CashIn'

/** The widest window the history endpoint takes, in days */
export const MAX_HISTORY_DAYS = 93

/** The generated client types every number as number | string */
export function num(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function presenceOf(status: string | null | undefined): RiderPresence {
  return status === 'Online' || status === 'Quiet' ? status : 'Off'
}

export const presenceTone: Record<RiderPresence, ChipTone> = {
  Online: 'success',
  Quiet: 'warning',
  Off: 'muted',
}

export const presenceLabel: Record<RiderPresence, TranslationKey> = {
  Online: 'riderOnline',
  Quiet: 'riderQuiet',
  Off: 'riderOff',
}

const presenceRank: Record<RiderPresence, number> = {
  Online: 0,
  Quiet: 1,
  Off: 2,
}

type SortableRider = {
  status?: string | null
  out?: number | string
  lastSeenAt?: string | null
  name?: string
}

/**
 * Online first, then quiet, then off; within each, whoever has the most out,
 * then whoever was heard from last, then by name. The server sends them so;
 * a live refresh keeps the same order.
 */
export function compareRiders(a: SortableRider, b: SortableRider): number {
  const rank =
    presenceRank[presenceOf(a.status)] - presenceRank[presenceOf(b.status)]
  if (rank !== 0) return rank
  const out = num(b.out) - num(a.out)
  if (out !== 0) return out
  const seen =
    (b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0) -
    (a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0)
  if (seen !== 0) return seen
  return (a.name ?? '').localeCompare(b.name ?? '')
}

function stageOf(stage: string | null | undefined): RiderStage {
  switch (stage) {
    case 'OnTheWay':
    case 'Delivered':
    case 'Failed':
    case 'Returned':
    case 'TakenBack':
    case 'GivenToOther':
      return stage
    default:
      return 'Assigned'
  }
}

export function stageTone(stage: string | null | undefined): ChipTone {
  switch (stageOf(stage)) {
    case 'Delivered':
      return 'success'
    case 'OnTheWay':
      return 'info'
    case 'Failed':
      return 'danger'
    case 'Returned':
      return 'warning'
    case 'TakenBack':
    case 'GivenToOther':
      return 'muted'
    default:
      return 'outline'
  }
}

const stageLabels: Record<RiderStage, TranslationKey> = {
  Assigned: 'riderStageAssigned',
  OnTheWay: 'riderStageOnTheWay',
  Delivered: 'riderStageDelivered',
  Failed: 'riderStageFailed',
  Returned: 'riderStageReturned',
  TakenBack: 'riderStageTakenBack',
  GivenToOther: 'riderStageGivenToOther',
}

export function stageLabel(stage: string | null | undefined): TranslationKey {
  return stageLabels[stageOf(stage)]
}

/** Still with the rider and not finished: what the "Now" list shows */
export function isOpenForRider(row: {
  stage?: string | null
  stillWithRider?: boolean
}): boolean {
  const stage = stageOf(row.stage)
  return (
    row.stillWithRider !== false &&
    (stage === 'Assigned' || stage === 'OnTheWay' || stage === 'Failed')
  )
}

const actionLabels: Record<DeliveryAction, TranslationKey> = {
  Assigned: 'riderStepAssigned',
  Unassigned: 'riderStepUnassigned',
  Reassigned: 'riderStepReassigned',
  Out: 'riderStepOut',
  Delivered: 'riderStepDelivered',
  Failed: 'riderStepFailed',
  Returned: 'riderStepReturned',
  CashIn: 'riderStepCashIn',
}

export function actionLabel(action: string | null | undefined): TranslationKey {
  return actionLabels[(action ?? '') as DeliveryAction] ?? 'riderStepAssigned'
}

/** Street, then building, floor and apartment, as one line */
export function addressLine(row: {
  address?: string | null
  building?: string | null
  floor?: string | null
  apartment?: string | null
}): string {
  return [row.address, row.building, row.floor, row.apartment]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

/** Short, over or even: how a cash difference reads */
export function cashDifferenceTone(
  difference: number | string | null | undefined
): 'short' | 'over' | 'even' | null {
  if (difference == null) return null
  const n = num(difference)
  if (n < 0) return 'short'
  if (n > 0) return 'over'
  return 'even'
}

/** The window spans more than the history endpoint takes */
export function windowTooWide(
  from: Date | null | undefined,
  to: Date | null | undefined
): boolean {
  if (!from || !to) return false
  return to.getTime() - from.getTime() > MAX_HISTORY_DAYS * 86_400_000
}
