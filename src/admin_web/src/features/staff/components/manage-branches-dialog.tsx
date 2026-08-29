import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Store } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  assignAdminMutation,
  getAllBranchesOptions,
  getBranchesByAdminOptions,
  removeAdminMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  type Customer,
  getCustomerDisplayName,
} from '@/features/customers/types'

interface ManageBranchesDialogProps {
  admin: Customer | null
  onOpenChange: (open: boolean) => void
}

/**
 * Assign an admin to branches (owner-only), mirroring the mobile admin
 * app's branch section: every branch listed, a switch per branch.
 * Owners aren't assignable — they see all branches implicitly.
 */
export function ManageBranchesDialog({
  admin,
  onOpenChange,
}: ManageBranchesDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()

  const adminUserId = admin?.id ?? ''

  const branchesQuery = useQuery({
    ...getAllBranchesOptions(),
    enabled: !!admin,
  })
  const assignedQuery = useQuery({
    ...getBranchesByAdminOptions({ path: { adminUserId } }),
    enabled: !!admin,
  })

  const invalidateAssigned = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranchesByAdmin' }] })

  const assign = useMutation({
    ...assignAdminMutation(),
    onSuccess: () => {
      invalidateAssigned()
      toast.success(t('adminAssigned'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const remove = useMutation({
    ...removeAdminMutation(),
    onSuccess: () => {
      invalidateAssigned()
      toast.success(t('adminRemoved'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const assignedIds = new Set(
    (assignedQuery.data ?? []).map((branch) => Number(branch.id))
  )
  const branches = branchesQuery.data ?? []
  const isLoading = branchesQuery.isLoading || assignedQuery.isLoading
  const isActing = assign.isPending || remove.isPending

  const toggle = (branchId: number, next: boolean) => {
    if (next) {
      assign.mutate({
        path: { id: branchId },
        body: { adminUserId },
      })
    } else {
      remove.mutate({ path: { id: branchId, userId: adminUserId } })
    }
  }

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('assignedBranches')}</DialogTitle>
          <DialogDescription>
            {admin ? getCustomerDisplayName(admin) : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex flex-col gap-2'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='h-14 rounded-md' />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('noBranchesFound')}
          </p>
        ) : (
          <div className='flex flex-col divide-y'>
            {branches.map((branch) => {
              const branchId = Number(branch.id)
              return (
                <div
                  key={branchId}
                  className='flex items-center gap-3 py-3'
                >
                  <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-md'>
                    <Store className='text-muted-foreground size-4' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>
                      {localized(branch.name)}
                    </div>
                    {localized(branch.address) && (
                      <div className='text-muted-foreground truncate text-xs'>
                        {localized(branch.address)}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={assignedIds.has(branchId)}
                    disabled={isActing}
                    onCheckedChange={(checked) => toggle(branchId, checked)}
                    aria-label={localized(branch.name)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
