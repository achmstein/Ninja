import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  Repeat,
  Settings2,
  Undo2,
} from 'lucide-react'
import { type ExpenseView } from '@/api/finance'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ExportButton } from '@/components/export-button'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { Stat } from '@/components/stat-strip'
import { monthRange } from '@/features/payroll/format'
import { CategoriesDialog } from './components/categories-dialog'
import { ExpenseDialog } from './components/expense-dialog'
import { ReceiptButton, ReceiptDialog } from './components/receipt-dialog'
import { RecurringDialog } from './components/recurring-dialog'
import { FINANCE_SOURCE, PAID_FROM, paidFromLabel, sourceLabel } from './format'
import { expensesQueryOptions } from './queries'
import { useFinanceActions } from './use-finance-actions'

const route = getRouteApi('/_authenticated/finance/expenses')

/**
 * The month's expenses at the branch: the total, what each category cost,
 * then the lines. Most arrive from the till; the rest are keyed in here.
 * A wrong line is voided with a reason and stays, struck through.
 */
export function Expenses() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const { voidExpense, isPending } = useFinanceActions()

  const today = formatDay(new Date())
  const [year, month] = (search.month ?? today.slice(0, 7))
    .split('-')
    .map(Number)
  const range = monthRange(year, month - 1)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  const expenses = useQuery(expensesQueryOptions(range.from, range.to))
  const [adding, setAdding] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [voiding, setVoiding] = useState<ExpenseView | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [viewingReceipt, setViewingReceipt] = useState<ExpenseView | null>(null)

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    navigate({
      search: (prev) => ({
        ...prev,
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
      }),
    })
  }

  const rows = expenses.data?.expenses ?? []

  // The month as a spreadsheet, voided lines included and marked as such
  const exportCsv = () =>
    downloadCsv(
      `expenses-${monthKey}`,
      [
        t('date'),
        t('expenseCategory'),
        t('vendor'),
        t('note'),
        t('paidFrom'),
        t('partner'),
        t('source'),
        t('amount'),
        t('voidedColumn'),
      ],
      rows.map((e) => [
        e.date,
        localized(e.categoryName),
        e.vendor,
        e.note,
        paidFromLabel(e.paidFrom, t),
        e.partnerName,
        sourceLabel(e.source, e.recordedBy, t),
        toNumber(e.amount),
        e.voidedAt ? e.voidReason || t('voided') : '',
      ])
    )

  return (
    <>
      <Main className='flex flex-col gap-6'>
        <PageHeader
          title={t('navFinanceExpenses')}
          description={t('expensesSubtitle')}
          actions={
            <div className='flex gap-2'>
              <Button variant='outline' onClick={() => setCategoriesOpen(true)}>
                <Settings2 className='me-2 h-4 w-4' />
                {t('expenseCategories')}
              </Button>
              <Button variant='outline' onClick={() => setRecurringOpen(true)}>
                <Repeat className='me-2 h-4 w-4' />
                {t('recurringBills')}
              </Button>
              <ExportButton onExport={exportCsv} disabled={rows.length === 0} />
              <Button onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addExpense')}
              </Button>
            </div>
          }
        >
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('previousMonth')}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className='h-4 w-4 rtl:-scale-x-100' />
            </Button>
            <span className='min-w-40 text-center text-sm font-medium'>
              {monthLabel}
            </span>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('nextMonth')}
              disabled={monthKey >= today.slice(0, 7)}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className='h-4 w-4 rtl:-scale-x-100' />
            </Button>
          </div>
        </PageHeader>

        {expenses.isError ? (
          <ErrorState error={expenses.error} onRetry={expenses.refetch} />
        ) : expenses.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('noExpenses')}
            description={t('noExpensesHint')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addExpense')}
              </Button>
            }
          />
        ) : (
          <>
            <div className='grid gap-6 lg:grid-cols-[auto_1fr]'>
              <Stat
                size='hero'
                label={t('expensesTotal')}
                value={formatEgp(expenses.data!.total)}
              />
              <dl className='divide-y text-sm'>
                {expenses.data!.byCategory.map((c) => (
                  <div
                    key={String(c.categoryId)}
                    className='flex items-center justify-between gap-4 py-1.5'
                  >
                    <dt>{localized(c.categoryName)}</dt>
                    <dd className='font-medium tabular-nums'>
                      {formatEgp(c.total)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className='overflow-x-auto rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('expenseCategory')}</TableHead>
                    <TableHead>{t('vendorOrNote')}</TableHead>
                    <TableHead>{t('paidFrom')}</TableHead>
                    <TableHead className='text-end'>{t('amount')}</TableHead>
                    <TableHead className='w-0' />
                    <TableHead className='w-0' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => {
                    const voided = !!e.voidedAt
                    return (
                      <TableRow
                        key={String(e.id)}
                        className={cn(voided && 'text-muted-foreground')}
                      >
                        <TableCell className='whitespace-nowrap tabular-nums'>
                          {dateFormat.format(new Date(e.date))}
                        </TableCell>
                        <TableCell className={cn(voided && 'line-through')}>
                          {localized(e.categoryName)}
                        </TableCell>
                        <TableCell className={cn(voided && 'line-through')}>
                          {[e.vendor, e.note].filter(Boolean).join(' · ') ||
                            '—'}
                          {voided && (
                            <span className='block text-xs no-underline'>
                              {t('voidedBecause', {
                                reason: e.voidReason ?? '',
                              })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className='flex flex-wrap items-center gap-1'>
                            {paidFromLabel(e.paidFrom, t)}
                            {toNumber(e.paidFrom) === PAID_FROM.partner &&
                              e.partnerName && (
                                <span className='text-muted-foreground'>
                                  ({e.partnerName})
                                </span>
                              )}
                            {toNumber(e.source) === FINANCE_SOURCE.till && (
                              <Badge variant='outline' className='font-normal'>
                                {t('fromTill')}
                              </Badge>
                            )}
                            {toNumber(e.source) ===
                              FINANCE_SOURCE.recurring && (
                              <Badge variant='outline' className='font-normal'>
                                {t('recurringBadge')}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-end font-medium tabular-nums',
                            voided && 'line-through'
                          )}
                        >
                          {formatEgp(e.amount)}
                        </TableCell>
                        <TableCell className='pe-0'>
                          <ReceiptButton
                            expense={e}
                            onView={() => setViewingReceipt(e)}
                          />
                        </TableCell>
                        <TableCell>
                          {!voided && (
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground size-8'
                              aria-label={t('voidExpense')}
                              title={t('voidExpense')}
                              disabled={isPending}
                              onClick={() => {
                                setVoidReason('')
                                setVoiding(e)
                              }}
                            >
                              <Undo2 className='h-4 w-4' />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Main>

      <ExpenseDialog open={adding} onOpenChange={setAdding} />
      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
      <RecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} />
      <ReceiptDialog
        expense={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />

      <ConfirmDialog
        open={voiding !== null}
        onOpenChange={(open) => !open && setVoiding(null)}
        destructive
        title={t('voidExpenseQuestion')}
        desc={
          <div className='space-y-3'>
            <p>{t('voidExpenseDescription')}</p>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='void-reason'>{t('reason')}</Label>
              <Input
                id='void-reason'
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        }
        confirmText={t('voidExpense')}
        disabled={voidReason.trim() === ''}
        isLoading={isPending}
        handleConfirm={async () => {
          if (!voiding) return
          try {
            await voidExpense(toNumber(voiding.id), voidReason.trim())
            setVoiding(null)
          } catch {
            // toasted by useFinanceActions
          }
        }}
      />
    </>
  )
}
