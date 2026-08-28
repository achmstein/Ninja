import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { loyaltyService } from '../services/loyalty-service'
import type { EarnPointsRequest, AdjustPointsRequest } from '../types'

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  accounts: () => [...loyaltyKeys.all, 'accounts'] as const,
  accountsList: (first?: number, max?: number) => [...loyaltyKeys.accounts(), { first, max }] as const,
  account: (userId: string) => [...loyaltyKeys.all, 'account', userId] as const,
  stats: () => [...loyaltyKeys.all, 'stats'] as const,
  tiers: () => [...loyaltyKeys.all, 'tiers'] as const,
  transactions: (userId: string) => [...loyaltyKeys.all, 'transactions', userId] as const,
}

export function useLoyaltyAccounts(first?: number, max?: number) {
  return useQuery({
    queryKey: loyaltyKeys.accountsList(first, max),
    queryFn: () => loyaltyService.getAccounts(first, max),
  })
}

export function useLoyaltyAccount(userId: string) {
  return useQuery({
    queryKey: loyaltyKeys.account(userId),
    queryFn: () => loyaltyService.getAccount(userId),
    enabled: !!userId,
  })
}

export function useLoyaltyStats() {
  return useQuery({
    queryKey: loyaltyKeys.stats(),
    queryFn: () => loyaltyService.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useLoyaltyTiers() {
  return useQuery({
    queryKey: loyaltyKeys.tiers(),
    queryFn: () => loyaltyService.getTiers(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - tiers rarely change
  })
}

export function useLoyaltyTransactions(userId: string) {
  return useQuery({
    queryKey: loyaltyKeys.transactions(userId),
    queryFn: () => loyaltyService.getTransactions(userId),
    enabled: !!userId,
  })
}

export function useEarnPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: EarnPointsRequest) => loyaltyService.earnPoints(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.accounts() })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.account(variables.userId) })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.transactions(variables.userId) })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.stats() })
      toast.success(translate('pointsAdded'))
    },
    onError: () => {
      toast.error(translate('failedToAddPoints'))
    },
  })
}

export function useAdjustPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AdjustPointsRequest) => loyaltyService.adjustPoints(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.accounts() })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.account(variables.userId) })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.transactions(variables.userId) })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.stats() })
      toast.success(translate('pointsAdjusted'))
    },
    onError: () => {
      toast.error(translate('failedToAdjustPoints'))
    },
  })
}
