import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getEmployeeOptions } from '@ninja/api/payroll/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { MetricStrip, MetricTile } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { EmployeeForm, EmploymentSection, PayTermsSection } from './components/employee-sheet'
import { LedgerSection } from './components/ledger-section'
import { readableDay } from './format'

/**
 * One employee as a page of their own, where the work on them is done: who
 * they are, what they are paid, what they are owed and why (the ledger),
 * and their employment, side by side on a desk and in turn on a phone.
 * Each thing is said once: the pay in its own card (not again in a tile
 * above it), the start date in the details (not again as "working since").
 * A page rather than a sheet: it is worked in, it has history, and it has
 * an address to come back to.
 */
export function EmployeePage({ employeeId }: { employeeId: number }) {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const employee = useQuery(
    getEmployeeOptions({
      path: { id: employeeId },
      query: { 'api-version': API_VERSION },
    })
  )
  const e = employee.data
  const balance = toNumber(e?.balance)

  return (
    <Main>
      <PageHeader
        back={{ to: '/payroll/employees' }}
        title={
          e ? (
            <span className='flex items-center gap-3'>
              <EntityAvatar name={e.name ?? ''} className='size-10' />
              {e.name}
            </span>
          ) : (
            '…'
          )
        }
        description={e?.jobTitle || undefined}
        badge={
          e && !e.isActive ? (
            <StatusChip tone='muted'>{t('leftOn', { date: readableDay(e.endedOn, locale, t) })}</StatusChip>
          ) : undefined
        }
      />

      {employee.isError ? (
        <ErrorState error={employee.error} onRetry={employee.refetch} />
      ) : !e ? (
        <div className='grid gap-4'>
          <Skeleton className='h-24' />
          <Skeleton className='h-64' />
        </div>
      ) : (
        <>
          <div className='grid items-start gap-4 lg:grid-cols-2'>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('details')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmployeeForm key={String(e.id)} employee={e} onSaved={() => {}} />
              </CardContent>
            </Card>
            <div className='grid gap-4'>
              <MetricStrip>
                <MetricTile
                  label={balance < 0 ? t('theyOwe') : t('owedToThem')}
                  value={<Money value={Math.abs(balance)} tone={balance < 0 ? 'negative' : 'none'} />}
                />
              </MetricStrip>
              <Card className='gap-3'>
                <CardHeader>
                  <CardTitle>{t('pay')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayTermsSection employee={e} />
                </CardContent>
              </Card>
              {/* The start date is in the details and a leaving date by the
                  name: only the way out (or back) is left to offer */}
              <EmploymentSection
                employee={e}
                showSince={false}
                onDeleted={() => navigate({ to: '/payroll/employees' })}
              />
            </div>
          </div>

          <Card className='gap-3'>
            <CardHeader>
              <CardTitle>{t('ledger')}</CardTitle>
            </CardHeader>
            <CardContent>
              <LedgerSection employee={e} showBalance={false} />
            </CardContent>
          </Card>
        </>
      )}
    </Main>
  )
}
