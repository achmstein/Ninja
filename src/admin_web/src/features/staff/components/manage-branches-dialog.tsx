import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Store } from 'lucide-react'
import { getAllBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { customersService } from '@/features/customers/services/customers-service'
import {
  type Customer,
  getCustomerDisplayName,
} from '@/features/customers/types'

interface ManageBranchesDialogProps {
  user: Customer | null
  onOpenChange: (open: boolean) => void
}

/**
 * The branches an Admin or Cashier may work in (owner-only): every branch
 * listed, a switch per branch, one save. Membership lives on the account
 * (the `branches` claim in the token), so the whole set is written at once
 * — per-switch writes would race each other. It reaches the user's token
 * on their next refresh. Owners aren't assignable — they hold every branch.
 */
export function ManageBranchesDialog({
  user,
  onOpenChange,
}: ManageBranchesDialogProps) {
  const t = useT()
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('assignedBranches')}</DialogTitle>
          <DialogDescription>
            {user ? getCustomerDisplayName(user) : ''}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by the account so the form mounts from what it holds today */}
        {user && (
          <BranchesForm key={user.id} user={user} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function BranchesForm({
  user,
  onOpenChange,
}: {
  user: Customer
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(user.branches ?? [])
  )

  const branchesQuery = useQuery(getAllBranchesOptions())

  const save = useMutation({
    mutationFn: () =>
      customersService.setBranches(
        user.id,
        [...selected].sort((a, b) => a - b)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('branchesUpdated'))
      onOpenChange(false)
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const branches = branchesQuery.data ?? []

  const toggle = (branchId: number, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(branchId)
      else next.delete(branchId)
      return next
    })

  return (
    <>
      {branchesQuery.isLoading ? (
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
              <div key={branchId} className='flex items-center gap-3 py-3'>
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
                  checked={selected.has(branchId)}
                  disabled={save.isPending}
                  onCheckedChange={(checked) => toggle(branchId, checked)}
                  aria-label={localized(branch.name)}
                />
              </div>
            )
          })}
        </div>
      )}

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button
          type='button'
          disabled={save.isPending || branchesQuery.isLoading}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </DialogFooter>
    </>
  )
}
