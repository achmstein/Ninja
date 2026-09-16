import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { getRealmRoles } from '@/config/oidc-config'
import { Store, UserPlus } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useLocale, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { customersService } from '@/features/customers/services/customers-service'
import {
  type Customer,
  getCustomerDisplayName,
  getCustomerInitials,
} from '@/features/customers/types'
import { AddStaffDialog } from './components/add-staff-dialog'
import { ManageBranchesDialog } from './components/manage-branches-dialog'

const columnHelper = createAppColumnHelper<Customer>()

// Owners first, then admins, then cashiers
const STAFF_ROLES = ['Owner', 'Admin', 'Cashier'] as const
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

  // Staff = users holding the Owner, Admin or Cashier realm role
  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () =>
      customersService.getCustomers({ role: 'Admin,Owner,Cashier', max: 200 }),
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
        : t('cashierRole')

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: 'avatar',
          header: '',
          cell: ({ row }) => (
            <Avatar className='h-8 w-8'>
              <AvatarFallback className='bg-primary/10 text-primary text-xs'>
                {getCustomerInitials(row.original)}
              </AvatarFallback>
            </Avatar>
          ),
          meta: { className: 'w-[50px]' },
        }),
        columnHelper.accessor((row) => getCustomerDisplayName(row), {
          id: 'name',
          header: t('name'),
          cell: ({ row }) => (
            <div className='flex flex-col'>
              <span className='font-medium'>
                {getCustomerDisplayName(row.original)}
              </span>
              <span className='text-muted-foreground text-xs'>
                {row.original.email || '—'}
              </span>
            </div>
          ),
        }),
        columnHelper.display({
          id: 'roles',
          header: t('roles'),
          cell: ({ row }) => (
            <div className='flex gap-1'>
              {STAFF_ROLES.filter((role) =>
                (row.original.realmRoles ?? []).includes(role)
              ).map((role) => (
                <Badge
                  key={role}
                  variant={
                    role === 'Owner'
                      ? 'default'
                      : role === 'Admin'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.createdTimestamp
              ? new Date(row.createdTimestamp).toLocaleDateString(locale)
              : '',
          {
            id: 'joined',
            header: t('joined'),
          }
        ),
        columnHelper.display({
          id: 'enabled',
          header: t('active'),
          cell: ({ row }) => (
            <Switch
              checked={row.original.enabled}
              disabled={
                !isOwner ||
                row.original.id === currentUserId ||
                toggleEnabled.isPending
              }
              onCheckedChange={() => toggleEnabled.mutate(row.original.id)}
              aria-label={t('toggleAccountFor', {
                name: getCustomerDisplayName(row.original),
              })}
            />
          ),
        }),
        columnHelper.display({
          id: 'branches',
          header: '',
          cell: ({ row }) =>
            // Owners hold every branch implicitly — Admins and Cashiers are assigned
            isOwner && !(row.original.realmRoles ?? []).includes('Owner') ? (
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('assignedBranches')}
                onClick={() => setBranchesUser(row.original)}
              >
                <Store className='h-4 w-4' />
              </Button>
            ) : null,
          meta: { className: 'w-[50px]' },
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
                <UserPlus className='me-2 h-4 w-4' />
                {t('addStaff')}
              </Button>
            )
          }
        />

        <DataTable
          table={table}
          isLoading={staffQuery.isLoading}
          emptyMessage={t('noAdminsFound')}
        />
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
