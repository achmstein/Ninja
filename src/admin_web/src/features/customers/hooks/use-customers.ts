import { useQuery } from '@tanstack/react-query'
import { customersService } from '../services/customers-service'
import type { CustomerParams } from '../types'

export const customersKeys = {
  all: ['customers'] as const,
  lists: () => [...customersKeys.all, 'list'] as const,
  list: (params: CustomerParams) => [...customersKeys.lists(), params] as const,
  detail: (id: string) => [...customersKeys.all, 'detail', id] as const,
  count: (search?: string) => [...customersKeys.all, 'count', search] as const,
}

export function useCustomers(params: CustomerParams = {}) {
  return useQuery({
    queryKey: customersKeys.list(params),
    queryFn: () => customersService.getCustomers(params),
  })
}

export function useCustomer(userId: string) {
  return useQuery({
    queryKey: customersKeys.detail(userId),
    queryFn: () => customersService.getCustomer(userId),
    enabled: !!userId,
  })
}

export function useCustomerCount(search?: string) {
  return useQuery({
    queryKey: customersKeys.count(search),
    queryFn: () => customersService.getCustomerCount(search),
  })
}
