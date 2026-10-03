import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { UserPlus, Users } from 'lucide-react'
import { type EmployeeView } from '@/api/payroll'
import { useLocale, useT } from '@/lib/i18n'
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
import { MetricStrip, MetricTile } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { CountUp } from '@/components/motion'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { EmployeeSheet } from './components/employee-sheet'
import { payLabel, readableDay } from './format'
import { PayrollTabs } from './payroll-tabs'
import { employeesQueryOptions } from './queries'

const route = getRouteApi('/_authenticated/payroll/employees')
const columnHelper = createAppColumnHelper<EmployeeView>()

/**
 * What they are owed now, if anything: the amount with a quiet "owed" under
 * it, or what they owe (an advance past their pay) in red. Nothing when
 * they are square.
 */
function Owed({ balance }: { balance: EmployeeView['balance'] }) {
  const t = useT()
  const n = toNumber(balance)
  if (n === 0) return null
  return n < 0 ? (
    <Money value={-n} tone='negative' sub={t('owesShort')} />
  ) : (
    <Money value={n} strong sub={t('owedShort')} />
  )
}

/** "Left 3 Oct", for someone no longer on the register */
function LeftChip({ employee }: { employee: EmployeeView }) {
  const t = useT()
  const locale = useLocale()
  if (employee.isActive) return null
  return (
    <StatusChip tone='muted'>
      {t('leftOn', { date: readableDay(employee.endedOn, locale, t) })}
    </StatusChip>
  )
}

/**
 * The register: who works at the branch, how each is paid in words, and
 * what each is owed now. A row opens the person's page; people who left
 * are behind the switch.
 */
export function Employees() {
  const t = useT()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const showInactive = search.inactive === true
  const goTo = useNavigate()

  const employees = useQuery(employeesQueryOptions(showInactive))
  const rows = employees.data ?? []
  const active = rows.filter((e) => e.isActive)
  const owedToStaff = rows.reduce(
    (sum, e) => sum + Math.max(0, toNumber(e.balance)),
    0
  )

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
              <EntityAvatar name={row.original.name} />
              <div className='flex min-w-0 flex-col leading-tight'>
                <span className='flex items-center gap-2 font-medium'>
                  {row.original.name}
                  <LeftChip employee={row.original} />
                </span>
                {row.original.jobTitle && (
                  <span className='text-muted-foreground text-xs'>
                    {row.original.jobTitle}
                  </span>
                )}
              </div>
            </div>
          ),
        }),
        columnHelper.display({
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
          header: t('owedToThem'),
          cell: ({ row }) => <Owed balance={row.original.balance} />,
        }),
      ]),
    [t]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
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
              <UserPlus />
              {t('addEmployee')}
            </Button>
          }
        >
          <PayrollTabs value='employees' />
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
        ) : !employees.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('noEmployees')}
            description={t('noEmployeesHint')}
            action={
              <Button onClick={() => open(undefined, true)}>
                <UserPlus />
                {t('addEmployee')}
              </Button>
            }
          />
        ) : (
          <>
            {/* Who works here, and what the business owes them all now */}
            <MetricStrip>
              <MetricTile
                label={t('workingHereCount')}
                loading={employees.isLoading}
                value={<CountUp value={active.length} />}
              />
              <MetricTile
                label={t('owedToStaff')}
                loading={employees.isLoading}
                value={<CountUp value={owedToStaff} format={formatEgp} />}
              />
            </MetricStrip>

            <DataTable
              table={table}
              isLoading={employees.isLoading}
              onRowClick={(row) =>
                goTo({
                  to: '/payroll/employee/$employeeId',
                  params: { employeeId: String(toNumber(row.original.id)) },
                })
              }
              mobileRow={({ original: e }) => (
                <ListRow
                  className={cn(!e.isActive && 'opacity-60')}
                  leading={<EntityAvatar name={e.name} />}
                  title={e.name}
                  meta={
                    <>
                      {e.jobTitle && (
                        <>
                          <span>{e.jobTitle}</span>
                          <Dot />
                        </>
                      )}
                      <span className='tabular-nums'>
                        {payLabel(e.currentTerms, t)}
                      </span>
                      <LeftChip employee={e} />
                    </>
                  }
                  trailing={<Owed balance={e.balance} />}
                />
              )}
            />
          </>
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
