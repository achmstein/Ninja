import { useQuery } from '@tanstack/react-query'
import { getBranchPricingOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBranchStore } from '@/stores/branch-store'
import { toPricingRules, type PricingRules } from './pricing'

/**
 * The active branch's VAT and service-charge rules, kept on the device
 * (lib/query-persist.ts) so a sale rung up offline is billed as Sales will
 * bill it when it is replayed. Read while online, all day, for that moment.
 */
export function useBranchPricing(): PricingRules | null {
  const branchId = useBranchStore((s) => s.branchId)
  const { data } = useQuery({
    ...getBranchPricingOptions({
      path: { branchId: branchId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: branchId !== null,
    staleTime: 5 * 60_000,
  })
  return data ? toPricingRules(data) : null
}
