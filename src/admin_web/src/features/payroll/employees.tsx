import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { KeyRound, UserPlus, Users } from 'lucide-react'
import { type EmployeeView } from '@/api/payroll'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { EmployeeSheet } from './components/employee-sheet'
import { payLabel } from './format'
import { employeesQueryOptions } from './queries'

const route = getRouteApi('/_authenticated/payroll/employees')
const columnHelper = createAppColumnHelper<EmployeeView>()

/** What the business owes them; what they owe (an advance past their pay) in red */
function Owed({ balance }: { balance: EmployeeView['balance'] }) {
  const t = useT()
  const n = toNumber(balance)
  return n < 0 ? (
    <span className='text-destructive tabular-nums'>
      {t('owesShort')} {formatEgp(-n)}
    </span>
  ) : (
    <Money value={n} strong={n > 0} dashZero />
  )
}

function EmployeeChips({ employee }: { employee: EmployeeView }) {
  const t = useT()
  return (
    <>
      {employee.userId && (
        <StatusChip tone='muted' icon={KeyRound}>
          {t('hasLogin')}
        </StatusChip>
      )}
      {!employee.isActive && (
        <StatusChip tone='muted'>
          {t('leftOn', { date: employee.endedOn ?? '' })}
        </StatusChip>
      )}
    </>
  )
}

/**
 * The register: everyone who works at the branch, with their pay and what
 * they are owed. A row opens the employee's sheet; a login is a badge, not
 * a requirement — a runner has none.
 */
export function Employees() {
  const t = useT()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const showInactive = search.inactive === true

  const employees = useQuery(employeesQueryOptions(showInactive))

  const open = (employee?: number, isNew?: boolean) =>
    navigate({
      search: (prev) => ({
        ...prev,
        employee: employee ?? undefined,
        new: isNew || undefined,
      }),
    })

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t('name'),
          cell: ({ row }) => (
            <div
              className={cn(
                'flex items-center gap-3',
                !row.original.isActive && 'opacity-60'
              )}
            >
              <EntityAvatar name={row.original.name ?? ''} />
              <div className='flex flex-col leading-tight'>
                <span className='font-medium'>{row.original.name}</span>
                <span className='text-muted-foreground text-xs'>
                  {row.original.jobTitle || '—'}
                </span>
              </div>
            </div>
          ),
        }),
        columnHelper.display({
          meta: { align: 'end' },
          id: 'pay',
          header: t('pay'),
          cell: ({ row }) => (
            <span className='tabular-nums'>
              {payLabel(row.original.currentTerms, t)}
            </span>
          ),
        }),
        columnHelper.accessor((row) => toNumber(row.balance), {
          meta: { align: 'end' },
          id: 'balance',
          header: t('owed'),
          cell: ({ row }) => <Owed balance={row.original.balance} />,
        }),
        columnHelper.display({
          id: 'status',
          header: '',
          cell: ({ row }) => (
            <div className='flex gap-1'>
              <EmployeeChips employee={row.original} />
            </div>
          ),
        }),
      ]),
    [t]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: employees.data ?? [],
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    // No pager: the register is one screen
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  })

  return (
    <>
      <Main>
        <PageHeader
          title={t('navPayrollEmployees')}
          actions={
            <Button size='sm' onClick={() => open(undefined, true)}>
              <UserPlus className='me-2 h-4 w-4' />
              {t('addEmployee')}
            </Button>
          }
        >
          <label className='flex items-center gap-2 text-sm'>
            <Switch
              checked={showInactive}
              onCheckedChange={(checked) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    inactive: checked || undefined,
                  }),
                })
              }
            />
            {t('showFormerEmployees')}
          </label>
        </PageHeader>

        {employees.isError ? (
          <ErrorState error={employees.error} onRetry={employees.refetch} />
        ) : !employees.isLoading && (employees.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title={t('noEmployees')}
            action={
              <Button onClick={() => open(undefined, true)}>
                <UserPlus className='me-2 h-4 w-4' />
                {t('addEmployee')}
              </Button>
            }
          />
        ) : (
          <DataTable
            table={table}
            isLoading={employees.isLoading}
            onRowClick={(row) => open(toNumber(row.original.id))}
            mobileRow={({ original: e }) => (
              <ListRow
                className={cn(!e.isActive && 'opacity-60')}
                leading={<EntityAvatar name={e.name ?? ''} />}
                title={e.name}
                meta={
                  <>
                    {e.jobTitle && <span>{e.jobTitle}</span>}
                    {e.jobTitle && <Dot />}
                    <span className='tabular-nums'>
                      {payLabel(e.currentTerms, t)}
                    </span>
                    <EmployeeChips employee={e} />
                  </>
                }
                trailing={<Owed balance={e.balance} />}
              />
            )}
          />
        )}
      </Main>

      <EmployeeSheet
        employeeId={search.employee ?? null}
        isNew={search.new === true}
        onClose={() => open()}
      />
    </>
  )
}
