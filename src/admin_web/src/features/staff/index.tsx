import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { UserPlus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useLocale, useT } from '@/lib/i18n'
import { useAuth } from 'react-oidc-context'
import { getRealmRoles } from '@/config/oidc-config'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { customersService } from '@/features/customers/services/customers-service'
import {
  type Customer,
  getCustomerDisplayName,
  getCustomerInitials,
} from '@/features/customers/types'
import { AddStaffDialog } from './components/add-staff-dialog'

const columnHelper = createAppColumnHelper<Customer>()

export function StaffManagement() {
  const t = useT()
  const locale = useLocale()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const isOwner = getRealmRoles(auth.user).includes('Owner')

  // Staff = users holding the Admin or Owner realm role (merged, deduped)
  const adminsQuery = useQuery({
    queryKey: ['staff', 'admins'],
    queryFn: () => customersService.getCustomers({ role: 'Admin', max: 200 }),
  })
  const ownersQuery = useQuery({
    queryKey: ['staff', 'owners'],
    queryFn: () => customersService.getCustomers({ role: 'Owner', max: 200 }),
  })

  const staff = useMemo(() => {
    const byId = new Map<string, Customer>()
    for (const user of [
      ...(ownersQuery.data ?? []),
      ...(adminsQuery.data ?? []),
    ]) {
      if (!byId.has(user.id)) byId.set(user.id, user)
    }
    return [...byId.values()]
  }, [adminsQuery.data, ownersQuery.data])

  const toggleEnabled = useMutation({
    mutationFn: (userId: string) => customersService.toggleEnabled(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('accountUpdated'))
    },
    onError: () => toast.error(t('failedToUpdateAccount')),
  })

  const currentUserId = auth.user?.profile?.sub

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
              {(row.original.realmRoles ?? [])
                .filter((r) => r === 'Admin' || r === 'Owner')
                .map((role) => (
                  <Badge
                    key={role}
                    variant={role === 'Owner' ? 'default' : 'secondary'}
                  >
                    {role === 'Owner' ? t('owner') : t('adminRole')}
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
  })

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{t('staff')}</h1>
            <p className='text-muted-foreground'>{t('staffSubtitle')}</p>
          </div>
          {isOwner && (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className='me-2 h-4 w-4' />
              {t('addAdmin')}
            </Button>
          )}
        </div>

        <DataTable
          table={table}
          isLoading={adminsQuery.isLoading || ownersQuery.isLoading}
          emptyMessage={t('noAdminsFound')}
        />
      </Main>

      <AddStaffDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
