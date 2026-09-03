import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { serviceRequestsService } from './service'

const KEY = [{ _id: 'serviceRequestsPending' }]

/**
 * The room requests waiting on staff — call a waiter, change a controller,
 * bring the bill, switch player mode. Kept live by the hub's
 * ServiceRequestCreated nudge (see use-pos-notifications); the interval is
 * only a fallback. Acknowledge marks one as seen; Done clears it.
 */
export function useServiceRequests() {
  const t = useT()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => serviceRequestsService.pending(),
    refetchInterval: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY })

  const acknowledge = useMutation({
    mutationFn: (id: number) => serviceRequestsService.acknowledge(id),
    onSuccess: invalidate,
    onError: () => toast.error(t('failedToUpdateRequest')),
  })

  const complete = useMutation({
    mutationFn: (id: number) => serviceRequestsService.complete(id),
    onSuccess: invalidate,
    onError: () => toast.error(t('failedToUpdateRequest')),
  })

  return {
    requests: query.data ?? [],
    isLoading: query.isLoading,
    isActing: acknowledge.isPending || complete.isPending,
    acknowledge: (id: number) => acknowledge.mutate(id),
    complete: (id: number) => complete.mutate(id),
  }
}
