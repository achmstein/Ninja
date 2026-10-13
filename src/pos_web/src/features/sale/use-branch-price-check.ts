import { useMutation } from '@tanstack/react-query'
import { checkBranchPricesMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import type { SaleLine } from './cart'
import { priceCheckLines, reviewPriceCheck, type PriceReview } from './price-check'

export type { PriceReview, PriceReviewItem } from './price-check'

/**
 * Asks Catalog what the cart costs at another branch now, and what it ran out
 * of, before the till sends it there: the same pricing that branch's order
 * check uses, so an order sent at these prices goes through.
 */
export function useBranchPriceCheck() {
  const mutation = useMutation({ ...checkBranchPricesMutation() })
  return {
    checking: mutation.isPending,
    check: async (branchId: number, lines: SaleLine[]): Promise<PriceReview> => {
      const answer = await mutation.mutateAsync({
        body: { branchId, lines: priceCheckLines(lines) },
        query: { 'api-version': API_VERSION },
      })
      return reviewPriceCheck(lines, answer.lines ?? [])
    },
  }
}
