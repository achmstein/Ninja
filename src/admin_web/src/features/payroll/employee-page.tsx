import { useQuery } from '@tanstack/react-query'
import { getEmployeeOptions } from '@/api/payroll/@tanstack/react-query.gen'
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
import {
  EmployeeForm,
  EmploymentSection,
  PayTermsSection,
} from './components/employee-sheet'
import { LedgerSection } from './components/ledger-section'
import { payLabel, readableDay } from './format'

/**
 * One employee as a page of their own, where the work on them is done: who
 * they are, what they are paid, what they are owed and why (the ledger),
 * and their employment, side by side on a desk and in turn on a phone, with
 * what they are owed and their pay at the top. A page rather than a sheet:
 * it is worked in, it has history, and it has an address to come back to.
 */
export function EmployeePage({ employeeId }: { employeeId: number }) {
  const t = useT()
  const locale = useLocale()
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
            <StatusChip tone='muted'>
              {t('leftOn', { date: readableDay(e.endedOn, locale, t) })}
            </StatusChip>
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
          <MetricStrip>
            <MetricTile
              label={balance < 0 ? t('theyOwe') : t('owedToThem')}
              value={
                <Money
                  value={Math.abs(balance)}
                  tone={balance < 0 ? 'negative' : 'none'}
                />
              }
            />
            <MetricTile label={t('pay')} value={payLabel(e.currentTerms, t)} />
          </MetricStrip>

          <div className='grid items-start gap-4 lg:grid-cols-2'>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('details')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmployeeForm
                  key={String(e.id)}
                  employee={e}
                  onSaved={() => {}}
                />
              </CardContent>
            </Card>
            <div className='grid gap-4'>
              <Card className='gap-3'>
                <CardHeader>
                  <CardTitle>{t('pay')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayTermsSection employee={e} />
                </CardContent>
              </Card>
              <Card className='gap-3'>
                <CardHeader>
                  <CardTitle>{t('employment')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmploymentSection employee={e} />
                </CardContent>
              </Card>
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
