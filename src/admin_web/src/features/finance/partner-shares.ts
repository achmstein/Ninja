import { type PartnerView } from '@/api/finance'
import { toNumber } from '@/lib/money'

/**
 * What is left of a branch's profit to give a partner: 100% less the
 * shares the other active partners hold there. The partner being edited is
 * left out, so their own share is part of what they may keep. Never below
 * zero (a branch already over-shared before the check existed has none left).
 */
export function remainingShare(
  partners: PartnerView[] | undefined,
  branchId: number,
  editingPartnerId: number | null
): number {
  const taken = (partners ?? [])
    .filter((p) => p.isActive && toNumber(p.id) !== editingPartnerId)
    .reduce(
      (sum, p) =>
        sum +
        p.shares
          .filter((s) => toNumber(s.branchId) === branchId)
          .reduce((s, share) => s + toNumber(share.percent), 0),
      0
    )
  return Math.max(0, Math.round((100 - taken) * 100) / 100)
}

/** A share as typed is one the branch has room for: 0 to what is left. */
export function shareFits(percent: number, remaining: number): boolean {
  return percent >= 0 && percent <= remaining + 1e-9
}
