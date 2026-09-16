import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Phone, Plus, Receipt } from 'lucide-react'
import { type BranchResponse } from '@/api/branch'
import {
  getAllBranchesOptions,
  updateBranchSettingsMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Main } from '@/components/layout/main'
import { BranchDialog } from './components/branch-dialog'
import { PricingDialog } from './components/pricing-dialog'

export function BranchesManagement() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pricingBranch, setPricingBranch] = useState<BranchResponse | null>(
    null
  )
  const [editingBranch, setEditingBranch] = useState<BranchResponse | null>(
    null
  )

  const { data: branches = [], isLoading } = useQuery(getAllBranchesOptions())

  const updateSettings = useMutation({
    ...updateBranchSettingsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllBranches' }] })
      toast.success(t('branchUpdatedSuccess'))
    },
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  const toggleSetting = (
    branch: BranchResponse,
    setting: 'isOrderingEnabled' | 'isReservationsEnabled',
    value: boolean
  ) =>
    updateSettings.mutate({
      path: { branchId: Number(branch.id) },
      body: { [setting]: value },
    })

  return (
    <>
      <Main>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('branches')}
            </h1>
            <p className='text-muted-foreground'>{t('branchesSubtitle')}</p>
          </div>
          <Button
            onClick={() => {
              setEditingBranch(null)
              setDialogOpen(true)
            }}
          >
            <Plus className='me-2 h-4 w-4' />
            {t('createBranch')}
          </Button>
        </div>
        {isLoading ? (
          <div className='grid gap-4 md:grid-cols-2'>
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className='h-56' />
            ))}
          </div>
        ) : (
          <div className='grid gap-4 md:grid-cols-2'>
            {branches.map((branch) => (
              <Card key={String(branch.id)}>
                <CardContent className='flex flex-col gap-4 pt-6'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <h3 className='text-sm font-medium'>
                          {localized(branch.name)}
                        </h3>
                        <Badge
                          variant={branch.isActive ? 'default' : 'secondary'}
                        >
                          {branch.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </div>
                    </div>
                    <div className='flex items-center'>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={t('receiptPricing')}
                        onClick={() => setPricingBranch(branch)}
                      >
                        <Receipt className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={t('editBranch')}
                        onClick={() => {
                          setEditingBranch(branch)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>

                  <div className='text-muted-foreground space-y-1 text-sm'>
                    {localized(branch.address) && (
                      <div className='flex items-center gap-2'>
                        <MapPin className='h-4 w-4' />
                        {localized(branch.address)}
                      </div>
                    )}
                    {branch.phone && (
                      <div className='flex items-center gap-2'>
                        <Phone className='h-4 w-4' />
                        {branch.phone}
                      </div>
                    )}
                    <div>
                      {t('businessHours')}: {branch.dayStartTime?.slice(0, 5)} –{' '}
                      {branch.dayEndTime?.slice(0, 5)}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='flex items-center justify-between rounded-lg border p-3'>
                      <Label className='text-sm'>{t('orderingEnabled')}</Label>
                      <Switch
                        checked={branch.isOrderingEnabled}
                        disabled={updateSettings.isPending}
                        onCheckedChange={(v) =>
                          toggleSetting(branch, 'isOrderingEnabled', v)
                        }
                      />
                    </div>
                    <div className='flex items-center justify-between rounded-lg border p-3'>
                      <Label className='text-sm'>
                        {t('reservationsEnabled')}
                      </Label>
                      <Switch
                        checked={branch.isReservationsEnabled}
                        disabled={updateSettings.isPending}
                        onCheckedChange={(v) =>
                          toggleSetting(branch, 'isReservationsEnabled', v)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Main>

      <PricingDialog
        branch={pricingBranch}
        onOpenChange={(open) => {
          if (!open) setPricingBranch(null)
        }}
      />

      <BranchDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingBranch(null)
        }}
        branch={editingBranch}
      />
    </>
  )
}
