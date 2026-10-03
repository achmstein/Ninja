import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Power,
  QrCode,
  Receipt,
  Search,
  UserCheck,
} from 'lucide-react'
import { type BranchResponse } from '@/api/tenant'
import {
  getAllBranchesOptions,
  updateBranchMutation,
  updateBranchSettingsMutation,
} from '@/api/tenant/@tanstack/react-query.gen'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import { BranchSheet, type BranchSetting } from './branch-sheet'
import { BranchDialog } from './components/branch-dialog'
import { KitchenDialog } from './components/kitchen-dialog'
import { PricingDialog } from './components/pricing-dialog'

type Filter = 'all' | 'active' | 'inactive'

/** Search and filters appear once the list is long enough to need them */
const MANY = 4

export function BranchesManagement() {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // The open branch by id, so its sheet follows every save
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchResponse | null>(
    null
  )
  const [pricingBranch, setPricingBranch] = useState<BranchResponse | null>(
    null
  )
  const [kitchenBranch, setKitchenBranch] = useState<BranchResponse | null>(
    null
  )
  const [deactivating, setDeactivating] = useState<BranchResponse | null>(null)

  const branchesQuery = useQuery(getAllBranchesOptions())
  const { data: branches = [], isLoading } = branchesQuery
  const openBranch = branches.find((b) => String(b.id) === openId) ?? null

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllBranches' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
  }

  const updateSettings = useMutation({
    ...updateBranchSettingsMutation(),
    onSuccess: () => {
      refresh()
      toast.success(t('branchUpdatedSuccess'))
    },
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  // Activating or deactivating sends the branch back as it is, with only
  // its state changed: the same call its edit form makes
  const updateBranch = useMutation({
    ...updateBranchMutation(),
    onSuccess: () => {
      refresh()
      setDeactivating(null)
      toast.success(t('branchUpdatedSuccess'))
    },
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  const toggleSetting = (
    branch: BranchResponse,
    setting: BranchSetting,
    value: boolean
  ) =>
    updateSettings.mutate({
      path: { branchId: Number(branch.id) },
      body: { [setting]: value },
    })

  const setActive = (branch: BranchResponse, isActive: boolean) =>
    updateBranch.mutate({
      path: { id: Number(branch.id) },
      body: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        taxNumber: branch.taxNumber,
        receiptFooter: branch.receiptFooter,
        isActive,
        displayOrder: branch.displayOrder,
        dayStartTime: branch.dayStartTime,
        isOrderingEnabled: branch.isOrderingEnabled,
        isReservationsEnabled: branch.isReservationsEnabled,
        requireSignInForTableOrders: branch.requireSignInForTableOrders,
      },
    })

  const askActive = (branch: BranchResponse, isActive: boolean) =>
    isActive ? setActive(branch, true) : setDeactivating(branch)

  const edit = (branch: BranchResponse | null) => {
    setEditingBranch(branch)
    setDialogOpen(true)
  }

  const open = (branch: BranchResponse) => {
    setOpenId(String(branch.id))
    setSheetOpen(true)
  }

  const counts = {
    all: branches.length,
    active: branches.filter((b) => b.isActive).length,
    inactive: branches.filter((b) => !b.isActive).length,
  }

  // The filters show only while some branch is inactive; once none is, all
  const by: Filter = counts.inactive > 0 ? filter : 'all'

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return branches.filter((b) => {
      if (by === 'active' && !b.isActive) return false
      if (by === 'inactive' && b.isActive) return false
      if (!q) return true
      return [
        b.name?.en,
        b.name?.ar,
        b.address?.en,
        b.address?.ar,
        b.phone,
      ].some((text) => text?.toLowerCase().includes(q))
    })
  }, [branches, by, query])

  const filtered = query.trim() !== '' || by !== 'all'
  const clearFilters = () => {
    setQuery('')
    setFilter('all')
  }

  return (
    <>
      <Main>
        <PageHeader
          title={t('branches')}
          description={t('branchesDescription')}
          actions={
            <Button size='sm' onClick={() => edit(null)}>
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
          <ListSkeleton />
        ) : branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t('noBranchesYet')}
            description={t('noBranchesYetHint')}
            action={
              <Button onClick={() => edit(null)}>
                <Plus />
                {t('createBranch')}
              </Button>
            }
          />
        ) : (
          <div className='grid gap-3'>
            {branches.length >= MANY && (
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                <div className='relative sm:w-72'>
                  <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
                  <Input
                    type='search'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('searchBranchesPlaceholder')}
                    className='h-9 ps-8'
                  />
                </div>
                {counts.inactive > 0 && (
                  <div className='flex flex-wrap gap-1'>
                    {(['all', 'active', 'inactive'] as const).map((f) => (
                      <Button
                        key={f}
                        variant={by === f ? 'secondary' : 'ghost'}
                        size='sm'
                        aria-pressed={by === f}
                        onClick={() => setFilter(f)}
                      >
                        {t(f)}
                        <span className='text-muted-foreground ms-1.5 tabular-nums'>
                          {counts[f]}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {shown.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t('noBranchesFound')}
                action={
                  filtered && (
                    <Button variant='outline' onClick={clearFilters}>
                      {t('clearFilters')}
                    </Button>
                  )
                }
              />
            ) : (
              <ul className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
                {shown.map((branch) => (
                  <li key={String(branch.id)}>
                    <BranchRow
                      branch={branch}
                      onOpen={() => open(branch)}
                      actions={
                        <RowActions
                          actions={[
                            {
                              label: t('editBranch'),
                              icon: Pencil,
                              onSelect: () => edit(branch),
                            },
                            {
                              label: t('kitchenStations'),
                              icon: ChefHat,
                              onSelect: () => setKitchenBranch(branch),
                              hidden: !features.kds,
                            },
                            {
                              label: t('receiptPricing'),
                              icon: Receipt,
                              onSelect: () => setPricingBranch(branch),
                            },
                            branch.isActive
                              ? {
                                  label: t('deactivateBranch'),
                                  icon: Power,
                                  destructive: true,
                                  onSelect: () => askActive(branch, false),
                                }
                              : {
                                  label: t('activateBranch'),
                                  icon: Power,
                                  disabled: updateBranch.isPending,
                                  onSelect: () => askActive(branch, true),
                                },
                          ]}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Main>

      <BranchSheet
        open={sheetOpen && openBranch != null}
        branch={openBranch}
        onOpenChange={setSheetOpen}
        savingSettings={updateSettings.isPending}
        onToggle={(setting, value) =>
          openBranch && toggleSetting(openBranch, setting, value)
        }
        onEdit={() => openBranch && edit(openBranch)}
        onKitchen={() => openBranch && setKitchenBranch(openBranch)}
        onPricing={() => openBranch && setPricingBranch(openBranch)}
        onSetActive={(active) => openBranch && askActive(openBranch, active)}
      />

      <ConfirmDialog
        open={deactivating != null}
        onOpenChange={(o) => {
          if (!o) setDeactivating(null)
        }}
        title={t('deactivateBranchConfirm', {
          name: deactivating ? localized(deactivating.name) : '',
        })}
        desc={t('deactivateBranchHint')}
        confirmText={t('deactivateBranch')}
        destructive
        isLoading={updateBranch.isPending}
        handleConfirm={() => deactivating && setActive(deactivating, false)}
      />

      <KitchenDialog
        branch={kitchenBranch}
        onOpenChange={(o) => {
          if (!o) setKitchenBranch(null)
        }}
      />

      <PricingDialog
        branch={pricingBranch}
        onOpenChange={(o) => {
          if (!o) setPricingBranch(null)
        }}
      />

      <BranchDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditingBranch(null)
        }}
        branch={editingBranch}
      />
    </>
  )
}

/**
 * A branch as one line of the list: its name and state, where it is, and
 * how it runs as small quiet facts. The row opens the branch; ⋯ holds the
 * quick ways into its dialogs.
 */
function BranchRow({
  branch,
  onOpen,
  actions,
}: {
  branch: BranchResponse
  onOpen: () => void
  actions: React.ReactNode
}) {
  const t = useT()
  const localized = useLocalized()
  const features = useFeatures()
  const cloudKitchen = useIsCloudKitchen()
  const where = [localized(branch.address), branch.phone]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className='hover:bg-muted/40 focus-visible:bg-muted/40 flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors outline-none sm:px-5'
    >
      <span
        className={cn(
          'bg-muted grid size-10 shrink-0 place-items-center rounded-lg',
          !branch.isActive && 'opacity-50'
        )}
      >
        <Building2 className='text-muted-foreground size-4' />
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <span
            className={cn(
              'truncate text-sm font-medium',
              !branch.isActive && 'text-muted-foreground'
            )}
          >
            {localized(branch.name)}
          </span>
          <StatusChip tone={branch.isActive ? 'success' : 'muted'}>
            {branch.isActive ? t('active') : t('inactive')}
          </StatusChip>
        </div>
        {where && (
          <div className='text-muted-foreground mt-0.5 truncate text-xs'>
            {where}
          </div>
        )}
        {branch.isActive && (
          <div className='text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <Fact icon={QrCode} muted={!branch.isOrderingEnabled}>
              {branch.isOrderingEnabled
                ? t('branchTakingOrders')
                : t('branchOrdersPaused')}
            </Fact>
            {features.reservations && branch.isReservationsEnabled && (
              <Fact icon={CalendarCheck}>{t('reservationsEnabled')}</Fact>
            )}
            {!cloudKitchen && branch.requireSignInForTableOrders && (
              <Fact icon={UserCheck}>{t('branchSignInForTables')}</Fact>
            )}
            <Fact icon={Clock}>
              {t('branchDayStartsAt', {
                time: branch.dayStartTime?.slice(0, 5) ?? '',
              })}
            </Fact>
          </div>
        )}
      </div>
      {actions}
      <ChevronRight className='text-muted-foreground hidden size-4 shrink-0 sm:block rtl:rotate-180' />
    </div>
  )
}

function Fact({
  icon: Icon,
  muted = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        muted && 'text-muted-foreground/60'
      )}
    >
      <Icon className='size-3.5' />
      {children}
    </span>
  )
}

function ListSkeleton() {
  return (
    <ul className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
      {[...Array(3)].map((_, i) => (
        <li key={i} className='flex items-center gap-3 px-4 py-3.5 sm:px-5'>
          <Skeleton className='size-10 rounded-lg' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </li>
      ))}
    </ul>
  )
}
