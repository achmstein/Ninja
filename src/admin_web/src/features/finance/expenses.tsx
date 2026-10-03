import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Download, Plus, Receipt, Repeat, Settings2, Undo2 } from 'lucide-react'
import { type ExpenseView } from '@/api/finance'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { dayHeading } from '@/lib/when'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { MonthSwitcher } from '@/components/month-switcher'
import { PageHeader } from '@/components/page-header'
import { RankedList } from '@/components/ranked-list'
import { RowActions } from '@/components/row-actions'
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
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  const expenses = useQuery(expensesQueryOptions(range.from, range.to))
  // The month before, to say whether spending went up or down
  const before = monthRange(
    month === 1 ? year - 1 : year,
    month === 1 ? 11 : month - 2
  )
  const lastMonth = useQuery(expensesQueryOptions(before.from, before.to))
  const lastTotal = toNumber(lastMonth.data?.total)
  const change =
    lastMonth.data && lastTotal > 0
      ? (toNumber(expenses.data?.total) - lastTotal) / lastTotal
      : null
  const [adding, setAdding] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [voiding, setVoiding] = useState<ExpenseView | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [viewingReceipt, setViewingReceipt] = useState<ExpenseView | null>(null)

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
      <Main>
        <PageHeader
          title={t('navFinanceExpenses')}
          actions={
            <div className='flex items-center gap-1'>
              <Button size='sm' onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addExpense')}
              </Button>
              {/* What is set up once in a while waits behind the menu, not beside the one button used daily */}
              <RowActions
                className='size-9'
                actions={[
                  {
                    label: t('expenseCategories'),
                    icon: Settings2,
                    onSelect: () => setCategoriesOpen(true),
                  },
                  {
                    label: t('recurringBills'),
                    icon: Repeat,
                    onSelect: () => setRecurringOpen(true),
                  },
                  {
                    label: t('exportCsv'),
                    icon: Download,
                    disabled: rows.length === 0,
                    onSelect: exportCsv,
                  },
                ]}
              />
            </div>
          }
        >
          <MonthSwitcher
            monthKey={monthKey}
            onChange={(next) =>
              navigate({ search: (prev) => ({ ...prev, month: next }) })
            }
          />
        </PageHeader>

        {expenses.isError ? (
          <ErrorState error={expenses.error} onRetry={expenses.refetch} />
        ) : expenses.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('noExpenses')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addExpense')}
              </Button>
            }
          />
        ) : (
          <>
            {/* The month's total, and where it went as bars the eye compares at once */}
            <div className='grid gap-6 lg:grid-cols-[minmax(12rem,auto)_1fr]'>
              <Stat
                size='hero'
                label={t('expensesTotal')}
                value={formatEgp(expenses.data!.total)}
                hint={
                  change != null ? (
                    // Spending: down is the good direction
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        change > 0.005 && 'text-destructive',
                        change < -0.005 && 'text-success'
                      )}
                    >
                      {`${change > 0 ? '+' : ''}${Math.round(change * 100)}% ${t('vsLastMonth')}`}
                    </span>
                  ) : undefined
                }
              />
              <RankedList
                items={[...expenses.data!.byCategory]
                  .sort((a, b) => toNumber(b.total) - toNumber(a.total))
                  .map((c) => ({
                    key: String(c.categoryId),
                    label: localized(c.categoryName),
                    value: toNumber(c.total),
                    display: formatEgp(c.total),
                    hint:
                      toNumber(expenses.data!.total) > 0
                        ? percent.format(
                            toNumber(c.total) / toNumber(expenses.data!.total)
                          )
                        : undefined,
                  }))}
              />
            </div>

            <ul className='divide-y overflow-hidden rounded-lg border'>
              {rows.map((e, index) => {
                const voided = !!e.voidedAt
                const newDay = index === 0 || rows[index - 1].date !== e.date
                return (
                  <Fragment key={String(e.id)}>
                    {newDay && (
                      <li className='bg-muted/40 text-muted-foreground px-4 py-1.5 text-xs font-medium'>
                        {dayHeading(e.date, locale, t)}
                      </li>
                    )}
                    <li
                      className={cn(
                        'flex items-center gap-2 py-2.5 ps-4 pe-2',
                        voided && 'text-muted-foreground'
                      )}
                    >
                      <ListRow
                        className='flex-1'
                        title={
                          <span className={cn(voided && 'line-through')}>
                            {[e.vendor, e.note].filter(Boolean).join(' · ') ||
                              localized(e.categoryName)}
                          </span>
                        }
                        meta={
                          <>
                            <span>{localized(e.categoryName)}</span>
                            <Dot />
                            <span>
                              {paidFromLabel(e.paidFrom, t)}
                              {toNumber(e.paidFrom) === PAID_FROM.partner &&
                                e.partnerName &&
                                ` (${e.partnerName})`}
                            </span>
                            {toNumber(e.source) === FINANCE_SOURCE.till && (
                              <Badge variant='muted'>{t('fromTill')}</Badge>
                            )}
                            {toNumber(e.source) ===
                              FINANCE_SOURCE.recurring && (
                              <Badge variant='muted'>
                                {t('recurringBadge')}
                              </Badge>
                            )}
                            {voided && (
                              <span className='text-destructive w-full'>
                                {t('voidedBecause', {
                                  reason: e.voidReason ?? '',
                                })}
                              </span>
                            )}
                          </>
                        }
                        trailing={
                          <span className={cn(voided && 'line-through')}>
                            <Money value={e.amount} />
                          </span>
                        }
                      />
                      <ReceiptButton
                        expense={e}
                        onView={() => setViewingReceipt(e)}
                      />
                      <RowActions
                        actions={[
                          {
                            label: t('voidExpense'),
                            icon: Undo2,
                            destructive: true,
                            disabled: isPending,
                            hidden: voided,
                            onSelect: () => {
                              setVoidReason('')
                              setVoiding(e)
                            },
                          },
                        ]}
                      />
                    </li>
                  </Fragment>
                )
              })}
            </ul>
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
