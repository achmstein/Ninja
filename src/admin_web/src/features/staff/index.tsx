import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { getRealmRoles } from '@/config/oidc-config'
import { Store, UserPlus } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useLocale, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { ListRow } from '@/components/list-row'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import { customersService } from '@/features/customers/services/customers-service'
import {
  type Customer,
  getCustomerDisplayName,
} from '@/features/customers/types'
import { AddStaffDialog } from './components/add-staff-dialog'
import { ManageBranchesDialog } from './components/manage-branches-dialog'

const columnHelper = createAppColumnHelper<Customer>()

// Owners first, then admins, then cashiers, kitchens and riders
const STAFF_ROLES = ['Owner', 'Admin', 'Cashier', 'Kitchen', 'Rider'] as const
const rank = (user: Customer) =>
  STAFF_ROLES.findIndex((role) => (user.realmRoles ?? []).includes(role))

export function StaffManagement() {
  const t = useT()
  const locale = useLocale()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [branchesUser, setBranchesUser] = useState<Customer | null>(null)

  const isOwner = getRealmRoles(auth.user).includes('Owner')

  // Staff = users holding the Owner, Admin, Cashier, Kitchen or Rider realm role
  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () =>
      customersService.getCustomers({
        role: 'Admin,Owner,Cashier,Kitchen,Rider',
        max: 200,
      }),
  })

  const staff = useMemo(
    () => [...(staffQuery.data ?? [])].sort((a, b) => rank(a) - rank(b)),
    [staffQuery.data]
  )

  const toggleEnabled = useMutation({
    mutationFn: (userId: string) => customersService.toggleEnabled(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('accountUpdated'))
    },
    onError: () => toast.error(t('failedToUpdateAccount')),
  })

  const currentUserId = auth.user?.profile?.sub

  const roleLabel = (role: string) =>
    role === 'Owner'
      ? t('owner')
      : role === 'Admin'
        ? t('adminRole')
        : role === 'Kitchen'
          ? t('kitchenRole')
          : role === 'Rider'
            ? t('riderRole')
            : t('cashierRole')

  const rolesOf = (user: (typeof staff)[number]) =>
    STAFF_ROLES.filter((role) => (user.realmRoles ?? []).includes(role)).map(
      (role) => (
        <StatusChip
          key={role}
          tone={
            role === 'Owner' ? 'info' : role === 'Admin' ? 'success' : 'muted'
          }
        >
          {roleLabel(role)}
        </StatusChip>
      )
    )

  const enabledSwitch = (user: (typeof staff)[number]) => (
    <Switch
      checked={user.enabled}
      disabled={
        !isOwner || user.id === currentUserId || toggleEnabled.isPending
      }
      onCheckedChange={() => toggleEnabled.mutate(user.id)}
      aria-label={t('toggleAccountFor', { name: getCustomerDisplayName(user) })}
    />
  )

  // Owners hold every branch implicitly; Admins and Cashiers are assigned theirs
  const actionsOf = (user: (typeof staff)[number]) => (
    <RowActions
      actions={[
        {
          label: t('assignedBranches'),
          icon: Store,
          hidden: !isOwner || (user.realmRoles ?? []).includes('Owner'),
          onSelect: () => setBranchesUser(user),
        },
      ]}
    />
  )

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => getCustomerDisplayName(row), {
          id: 'name',
          header: t('name'),
          cell: ({ row }) => (
            <div
              className={cn(
                'flex items-center gap-3',
                !row.original.enabled && 'opacity-60'
              )}
            >
              <EntityAvatar name={getCustomerDisplayName(row.original)} />
              <div className='flex min-w-0 flex-col leading-tight'>
                <span className='truncate font-medium'>
                  {getCustomerDisplayName(row.original)}
                </span>
                {row.original.email && (
                  <span className='text-muted-foreground truncate text-xs'>
                    {row.original.email}
                  </span>
                )}
              </div>
            </div>
          ),
        }),
        columnHelper.display({
          id: 'roles',
          header: t('roles'),
          cell: ({ row }) => (
            <div className='flex flex-wrap gap-1'>{rolesOf(row.original)}</div>
          ),
        }),
        columnHelper.display({
          id: 'enabled',
          header: t('active'),
          cell: ({ row }) => enabledSwitch(row.original),
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => actionsOf(row.original),
          meta: { className: 'w-[48px]' },
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOwner, currentUserId, toggleEnabled.isPending, locale]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: staff,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    // No pager on this page: TanStack v9 would otherwise cap rows at 10
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  })

  return (
    <>
      <Main>
        <PageHeader
          title={t('staffAccounts')}
          actions={
            isOwner && (
              <Button size='sm' onClick={() => setAddOpen(true)}>
                <UserPlus />
                {t('addStaff')}
              </Button>
            )
          }
        />

        {staffQuery.isError ? (
          <ErrorState error={staffQuery.error} onRetry={staffQuery.refetch} />
        ) : (
          <DataTable
            table={table}
            isLoading={staffQuery.isLoading}
            emptyMessage={t('noAdminsFound')}
            mobileRow={({ original: user }) => (
              <div className='flex items-center gap-2'>
                <ListRow
                  className={cn('flex-1', !user.enabled && 'opacity-60')}
                  leading={<EntityAvatar name={getCustomerDisplayName(user)} />}
                  title={getCustomerDisplayName(user)}
                  meta={rolesOf(user)}
                />
                {enabledSwitch(user)}
                {actionsOf(user)}
              </div>
            )}
          />
        )}
      </Main>

      <AddStaffDialog open={addOpen} onOpenChange={setAddOpen} />

      <ManageBranchesDialog
        user={branchesUser}
        onOpenChange={(open) => {
          if (!open) setBranchesUser(null)
        }}
      />
    </>
  )
}
