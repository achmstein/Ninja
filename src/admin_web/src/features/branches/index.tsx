import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  QrCode,
  Receipt,
} from 'lucide-react'
import { type BranchResponse } from '@/api/tenant'
import {
  getAllBranchesOptions,
  updateBranchSettingsMutation,
} from '@/api/tenant/@tanstack/react-query.gen'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/error-state'
import { SettingRow, SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { BranchDialog } from './components/branch-dialog'
import { KitchenDialog } from './components/kitchen-dialog'
import { PricingDialog } from './components/pricing-dialog'

export function BranchesManagement() {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pricingBranch, setPricingBranch] = useState<BranchResponse | null>(
    null
  )
  const [kitchenBranch, setKitchenBranch] = useState<BranchResponse | null>(
    null
  )
  const [editingBranch, setEditingBranch] = useState<BranchResponse | null>(
    null
  )

  const branchesQuery = useQuery(getAllBranchesOptions())
  const { data: branches = [], isLoading } = branchesQuery

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
        <PageHeader
          title={t('branches')}
          description={t('branchesDescription')}
          actions={
            <Button
              size='sm'
              onClick={() => {
                setEditingBranch(null)
                setDialogOpen(true)
              }}
            >
              <Plus />
              {t('createBranch')}
            </Button>
          }
        />
        {branchesQuery.isError ? (
          <ErrorState
            error={branchesQuery.error}
            onRetry={branchesQuery.refetch}
          />
        ) : isLoading ? (
          <div className='grid gap-4 md:grid-cols-2'>
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className='h-56' />
            ))}
          </div>
        ) : (
          <div className='grid gap-4'>
            {branches.map((branch) => (
              // A branch as a console lays out a resource's settings: who it
              // is at the top, then each setting a row with its control
              <SettingsCard
                key={String(branch.id)}
                title={
                  <span className='flex items-center gap-2'>
                    {localized(branch.name)}
                    <StatusChip tone={branch.isActive ? 'success' : 'muted'}>
                      {branch.isActive ? t('active') : t('inactive')}
                    </StatusChip>
                  </span>
                }
                description={
                  [localized(branch.address), branch.phone]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
              >
                <SettingRow
                  icon={QrCode}
                  title={t('orderingEnabled')}
                  description={t('orderingEnabledHint')}
                  control={
                    <Switch
                      checked={branch.isOrderingEnabled}
                      disabled={updateSettings.isPending}
                      onCheckedChange={(v) =>
                        toggleSetting(branch, 'isOrderingEnabled', v)
                      }
                    />
                  }
                />
                {features.reservations && (
                  <SettingRow
                    icon={CalendarCheck}
                    title={t('reservationsEnabled')}
                    description={t('reservationsEnabledHint')}
                    control={
                      <Switch
                        checked={branch.isReservationsEnabled}
                        disabled={updateSettings.isPending}
                        onCheckedChange={(v) =>
                          toggleSetting(branch, 'isReservationsEnabled', v)
                        }
                      />
                    }
                  />
                )}
                <SettingRow
                  icon={Clock}
                  title={t('dayStartTime')}
                  description={t('dayStartsHint')}
                  control={
                    <span className='bg-muted rounded-md px-2.5 py-1 font-mono text-sm tabular-nums'>
                      {branch.dayStartTime?.slice(0, 5)}
                    </span>
                  }
                />
                <RowButton
                  icon={Receipt}
                  title={t('receiptPricing')}
                  description={t('receiptPricingHint')}
                  onClick={() => setPricingBranch(branch)}
                />
                {features.kds && (
                  <RowButton
                    icon={ChefHat}
                    title={t('kitchenStations')}
                    description={t('kitchenStationsHint')}
                    onClick={() => setKitchenBranch(branch)}
                  />
                )}
                <RowButton
                  icon={Pencil}
                  title={t('editBranch')}
                  description={t('branchDetailsHint')}
                  onClick={() => {
                    setEditingBranch(branch)
                    setDialogOpen(true)
                  }}
                />
              </SettingsCard>
            ))}
          </div>
        )}
      </Main>

      <KitchenDialog
        branch={kitchenBranch}
        onOpenChange={(open) => {
          if (!open) setKitchenBranch(null)
        }}
      />

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

/** A setting kept in its own dialog: the whole row opens it */
function RowButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  description: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='hover:bg-muted/40 block w-full text-start transition-colors'
    >
      <SettingRow
        icon={icon}
        title={title}
        description={description}
        control={
          <ChevronRight className='text-muted-foreground size-4 rtl:rotate-180' />
        }
      />
    </button>
  )
}
