import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  Banknote,
  CheckCircle2,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { type PayslipView } from '@/api/payroll'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useT, type Translate } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { EntityAvatar } from '@/components/entity-avatar'
import { EntitySheet } from '@/components/entity-sheet'
import { ErrorState } from '@/components/error-state'
import { ExportButton } from '@/components/export-button'
import { InfoTip } from '@/components/info-tip'
import { AttentionBanner, MetricStrip, MetricTile } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { MonthSwitcher } from '@/components/month-switcher'
import { CountUp } from '@/components/motion'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import {
  LEDGER_SOURCE,
  LEDGER_TYPE,
  monthName,
  monthPaid,
  monthPay,
  monthRange,
  PAY_SCHEME,
  payLabel,
  PAYSLIP_STATUS,
  payslipState,
  readableDay,
  schemeLabel,
  type PayslipState,
} from './format'
import { PayrollTabs } from './payroll-tabs'
import {
  employeesQueryOptions,
  ledgerQueryOptions,
  payslipsQueryOptions,
} from './queries'
import { usePayrollActions } from './use-payroll-actions'

const route = getRouteApi('/_authenticated/payroll/payslips')

// Who to deal with first: those still to be paid, then the rest, the paid last
const stateOrder: Record<PayslipState, number> = {
  toPay: 0,
  owes: 1,
  nothing: 2,
  paid: 3,
}

/**
 * How the month was paid, in a few words for a row: "26 days × EGP 230",
 * "EGP 6,000 a month", or "pay changed 13 Sep" when the month straddles a
 * change and no single rate describes it.
 */
function payShort(p: PayslipView, t: Translate, locale: string): string {
  if (p.termsChangedOn) {
    return t('payChangedOn', {
      date: readableDay(p.termsChangedOn, locale, t),
    })
  }
  if (toNumber(p.scheme) !== PAY_SCHEME.daily) return payLabel(p, t)
  return t('daysAtRate', {
    days: String(toNumber(p.daysWorked) + toNumber(p.paidOffDays)),
    rate: formatEgp(p.rate),
  })
}

/** The payslip's state as a chip: To pay, Paid 3 Oct, Nothing to pay, Owes */
function PayslipChip({ payslip }: { payslip: PayslipView }) {
  const t = useT()
  const locale = useLocale()
  switch (payslipState(payslip)) {
    case 'paid':
      return (
        <StatusChip tone='success'>
          {payslip.paidAt
            ? t('paidOn', { date: readableDay(payslip.paidAt, locale, t) })
            : t('paidStatus')}
        </StatusChip>
      )
    case 'toPay':
      return <StatusChip tone='warning'>{t('payslipToPay')}</StatusChip>
    case 'owes':
      return <StatusChip tone='danger'>{t('payslipOwesBack')}</StatusChip>
    default:
      return <StatusChip tone='muted'>{t('payslipNothingToPay')}</StatusChip>
  }
}

/** The figure a payslip ends on: what was handed over, or what is still owed */
function payslipAmount(p: PayslipView): number {
  return payslipState(p) === 'paid'
    ? toNumber(p.paidAmount ?? p.remaining)
    : toNumber(p.remaining)
}

/**
 * A month's pay, one person a row: what they are owed, what was paid, and
 * what to do next. A row opens the breakdown in words, with Pay at the
 * bottom. Payslips are made for everyone at once; a draft can be refreshed
 * after attendance is corrected, or dropped; a paid one is history.
 */
export function Payslips() {
  const t = useT()
  const locale = useLocale()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const { generatePayslips, deletePayslip, isPending } = usePayrollActions()

  const today = formatDay(new Date())
  const [year, month] = (search.month ?? today.slice(0, 7))
    .split('-')
    .map(Number)
  const range = monthRange(year, month - 1)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = monthName(year, month, locale)

  const payslips = useQuery(payslipsQueryOptions(range.from, range.to))
  // For each person's job under their name; people who left still have payslips
  const employees = useQuery(employeesQueryOptions(true))
  const jobOf = (employeeId: PayslipView['employeeId']) =>
    employees.data?.find((e) => toNumber(e.id) === toNumber(employeeId))
      ?.jobTitle ?? null

  const [openId, setOpenId] = useState<string | null>(null)
  const [paying, setPaying] = useState<PayslipView | null>(null)
  const [deleting, setDeleting] = useState<PayslipView | null>(null)

  const generate = (employeeId?: number) =>
    generatePayslips({
      employeeId: employeeId ?? null,
      periodStart: range.from,
      periodEnd: range.to,
    }).catch(() => {
      // toasted by usePayrollActions
    })

  const rows = [...(payslips.data ?? [])].sort(
    (a, b) => stateOrder[payslipState(a)] - stateOrder[payslipState(b)]
  )
  const opened = rows.find((p) => String(p.id) === openId) ?? null

  const toPay = rows.filter((p) => payslipState(p) === 'toPay')
  const stillOwed = toPay.reduce((sum, p) => sum + toNumber(p.remaining), 0)
  const totalPay = rows.reduce((sum, p) => sum + monthPay(p), 0)
  const totalPaid = rows.reduce((sum, p) => sum + monthPaid(p), 0)

  // The month's payslips as a spreadsheet, one row per person
  const exportCsv = () =>
    downloadCsv(
      `payslips-${monthKey}`,
      [
        t('employee'),
        t('payScheme'),
        t('payRate'),
        t('daysShort'),
        t('paidDaysOff'),
        t('absentDays'),
        t('overtimeHours'),
        t('ledgerEarned'),
        t('overtimePay'),
        t('absenceDeduction'),
        t('ledgerBonus'),
        t('ledgerDeduction'),
        t('advancesTaken'),
        t('paidInPeriod'),
        t('carriedOver'),
        t('amountDue'),
        t('remainingToPay'),
        t('status'),
        t('amountPaid'),
      ],
      rows.map((p) => [
        p.employeeName,
        schemeLabel(p.scheme, t),
        toNumber(p.rate),
        toNumber(p.daysWorked),
        toNumber(p.paidOffDays),
        toNumber(p.absentDays),
        toNumber(p.overtimeHours),
        toNumber(p.earned),
        toNumber(p.overtimePay),
        toNumber(p.absenceDeduction),
        toNumber(p.bonuses),
        toNumber(p.deductions),
        toNumber(p.advances),
        toNumber(p.payments),
        toNumber(p.carriedOver),
        toNumber(p.amountDue),
        toNumber(p.remaining),
        toNumber(p.status) === PAYSLIP_STATUS.paid
          ? t('paidStatus')
          : t('draft'),
        p.paidAmount == null ? '' : toNumber(p.paidAmount),
      ])
    )

  return (
    <>
      <Main>
        <PageHeader
          title={t('navPayrollEmployees')}
          actions={
            <div className='flex gap-2'>
              <ExportButton onExport={exportCsv} disabled={rows.length === 0} />
              {rows.length > 0 && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => generate()}
                  disabled={isPending}
                >
                  {isPending ? <Spinner /> : <RefreshCw />}
                  {t('refreshPayslips')}
                </Button>
              )}
            </div>
          }
        >
          <PayrollTabs value='payslips' />
          <MonthSwitcher
            monthKey={monthKey}
            onChange={(next) =>
              navigate({ search: (prev) => ({ ...prev, month: next }) })
            }
          />
        </PageHeader>

        {payslips.isError ? (
          <ErrorState error={payslips.error} onRetry={payslips.refetch} />
        ) : payslips.isLoading ? (
          <div className='grid gap-4'>
            <Skeleton className='h-24 rounded-xl' />
            <Skeleton className='h-64 rounded-xl' />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('noPayslips')}
            description={t('noPayslipsHint')}
            action={
              <Button onClick={() => generate()} disabled={isPending}>
                {isPending ? <Spinner /> : <FileText />}
                {t('generatePayslips')}
              </Button>
            }
          />
        ) : (
          <>
            {/* The month in one sentence: who is still to be paid, and how much */}
            {toPay.length > 0 ? (
              <AttentionBanner tone='info'>
                {t('payRunLine', {
                  count: toPay.length,
                  amount: formatEgp(stillOwed),
                })}
              </AttentionBanner>
            ) : (
              <p className='text-success flex items-center gap-2 text-sm font-medium'>
                <CheckCircle2 className='size-4' />
                {t('everyonePaidLine')}
              </p>
            )}

            <MetricStrip>
              <MetricTile
                label={t('monthPayTotal')}
                value={<CountUp value={totalPay} format={formatEgp} />}
              />
              <MetricTile
                label={t('paidSoFar')}
                value={<CountUp value={totalPaid} format={formatEgp} />}
              />
              <MetricTile
                label={t('dueTotal')}
                value={
                  <span
                    className={
                      stillOwed > 0
                        ? 'text-warning-foreground dark:text-warning'
                        : undefined
                    }
                  >
                    <CountUp value={stillOwed} format={formatEgp} />
                  </span>
                }
              />
            </MetricStrip>

            <ul className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
              {rows.map((p) => {
                const job = jobOf(p.employeeId)
                const state = payslipState(p)
                return (
                  <li key={String(p.id)}>
                    <button
                      type='button'
                      onClick={() => setOpenId(String(p.id))}
                      className='hover:bg-muted/40 active:bg-muted w-full px-4 py-3 text-start transition-colors'
                    >
                      <ListRow
                        leading={<EntityAvatar name={p.employeeName ?? ''} />}
                        title={p.employeeName}
                        meta={
                          <>
                            {job && (
                              <>
                                <span>{job}</span>
                                <Dot />
                              </>
                            )}
                            <span className='tabular-nums'>
                              {payShort(p, t, locale)}
                            </span>
                            {toNumber(p.overtimeHours) > 0 && (
                              <>
                                <Dot />
                                <span className='tabular-nums'>
                                  +{toNumber(p.overtimeHours)}
                                  {t('hoursAbbr')} {t('overtimeShort')}
                                </span>
                              </>
                            )}
                            {toNumber(p.absentDays) > 0 && (
                              <>
                                <Dot />
                                <span>
                                  {t('absentDaysShort', {
                                    count: toNumber(p.absentDays),
                                  })}
                                </span>
                              </>
                            )}
                          </>
                        }
                        trailing={
                          <Money
                            value={payslipAmount(p)}
                            strong={state === 'toPay' || state === 'paid'}
                            tone={state === 'owes' ? 'negative' : 'none'}
                            dashZero
                          />
                        }
                        trailingMeta={<PayslipChip payslip={p} />}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Main>

      <PayslipSheet
        payslip={opened}
        job={opened ? jobOf(opened.employeeId) : null}
        monthLabel={monthLabel}
        busy={isPending}
        onClose={() => setOpenId(null)}
        onPay={() => opened && setPaying(opened)}
        onRefresh={() => opened && generate(toNumber(opened.employeeId))}
        onDelete={() => opened && setDeleting(opened)}
      />

      <PayDialog
        payslip={paying}
        monthLabel={monthLabel}
        onClose={() => setPaying(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        destructive
        title={t('deletePayslipQuestion')}
        desc={t('deletePayslipDescription')}
        confirmText={t('deletePayslip')}
        isLoading={isPending}
        handleConfirm={async () => {
          if (!deleting) return
          try {
            await deletePayslip(toNumber(deleting.id))
            setDeleting(null)
            setOpenId(null)
          } catch {
            // toasted by usePayrollActions
          }
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// One payslip: the amount, how it adds up in words, and Pay

/** One line of the breakdown: what it is in words, a quiet detail, the amount */
function Line({
  label,
  detail,
  value,
  children,
}: {
  label: ReactNode
  detail?: ReactNode
  /** Signed: what adds to their pay is positive, what comes off negative */
  value: number
  /** The dated entries behind it */
  children?: ReactNode
}) {
  return (
    <li className='py-2.5'>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <div className='text-sm'>{label}</div>
          {detail && (
            <div className='text-muted-foreground mt-0.5 text-xs'>{detail}</div>
          )}
        </div>
        <Money
          value={value}
          signed
          className={cn('text-sm', value < 0 && 'text-muted-foreground')}
        />
      </div>
      {children}
    </li>
  )
}

function PayslipSheet({
  payslip,
  job,
  monthLabel,
  busy,
  onClose,
  onPay,
  onRefresh,
  onDelete,
}: {
  payslip: PayslipView | null
  job: string | null
  monthLabel: string
  busy: boolean
  onClose: () => void
  onPay: () => void
  onRefresh: () => void
  onDelete: () => void
}) {
  const t = useT()
  const p = payslip
  const state = p ? payslipState(p) : 'nothing'
  const draft = p !== null && state !== 'paid'
  const remaining = toNumber(p?.remaining)

  return (
    <EntitySheet
      open={p !== null}
      onOpenChange={(next) => !next && onClose()}
      title={
        p ? (
          <span className='flex items-center gap-3'>
            <EntityAvatar name={p.employeeName ?? ''} />
            {p.employeeName}
          </span>
        ) : (
          '…'
        )
      }
      subtitle={job ? `${job} · ${monthLabel}` : monthLabel}
      status={p ? <PayslipChip payslip={p} /> : undefined}
      headerAction={
        draft ? (
          <RowActions
            actions={[
              {
                label: t('refreshPayslip'),
                icon: RefreshCw,
                disabled: busy,
                onSelect: onRefresh,
              },
              {
                label: t('deletePayslip'),
                icon: Trash2,
                destructive: true,
                disabled: busy,
                onSelect: onDelete,
              },
            ]}
          />
        ) : undefined
      }
      actions={
        draft ? (
          <Button onClick={onPay} disabled={busy}>
            <Banknote />
            {remaining > 0
              ? t('payAmountAction', { amount: formatEgp(remaining) })
              : t('markPaidAction')}
          </Button>
        ) : undefined
      }
    >
      {p && <PayslipBreakdown payslip={p} />}
    </EntitySheet>
  )
}

function PayslipBreakdown({ payslip: p }: { payslip: PayslipView }) {
  const t = useT()
  const locale = useLocale()
  const state = payslipState(p)
  const n = (value: number | string | null | undefined) => toNumber(value)

  // The dated advances, payments, bonuses and deductions behind the month's
  // totals, read from the person's account
  const ledger = useQuery(ledgerQueryOptions(n(p.employeeId)))
  const inMonth = (ledger.data?.entries ?? []).filter(
    (e) =>
      e.date >= p.periodStart &&
      e.date <= p.periodEnd &&
      n(e.source) !== LEDGER_SOURCE.payslip
  )
  /** The entries of a kind, shown only when they add up to the payslip's figure */
  const entriesOf = (type: number, total: number | string) => {
    const entries = inMonth.filter((e) => n(e.type) === type)
    const sum = entries.reduce((s, e) => s + n(e.amount), 0)
    if (entries.length === 0 || Math.abs(sum - n(total)) > 0.005) return null
    return (
      <ul className='text-muted-foreground mt-1.5 space-y-1 border-s ps-3 text-xs'>
        {entries.map((e) => (
          <li key={String(e.id)} className='flex justify-between gap-4'>
            <span className='min-w-0 truncate'>
              {readableDay(e.date, locale, t)}
              {e.note && ` · ${e.note}`}
              {n(e.source) === LEDGER_SOURCE.tillPayOut &&
                ` · ${t('fromTill')}`}
            </span>
            <span className='shrink-0 tabular-nums'>{formatEgp(e.amount)}</span>
          </li>
        ))}
      </ul>
    )
  }

  const daily = n(p.scheme) === PAY_SCHEME.daily
  const paidDays = n(p.daysWorked) + n(p.paidOffDays)
  const baseLabel = p.termsChangedOn
    ? t('basePayChanged', { date: readableDay(p.termsChangedOn, locale, t) })
    : daily
      ? t('basePayDays', { count: paidDays, rate: formatEgp(p.rate) })
      : t('basePayMonthly')

  const headline =
    state === 'paid'
      ? t('payslipPaidLine', {
          date: p.paidAt ? readableDay(p.paidAt, locale, t) : '',
        })
      : state === 'owes'
        ? t('theyOwe')
        : t('payslipTotalLine')
  const headlineAmount =
    state === 'paid' ? n(p.paidAmount ?? p.remaining) : Math.abs(n(p.remaining))

  return (
    <>
      <div>
        <div className='text-muted-foreground text-sm'>{headline}</div>
        <div
          className={cn(
            'mt-1 text-3xl font-semibold tracking-tight tabular-nums',
            state === 'owes' && 'text-destructive'
          )}
        >
          {formatEgp(headlineAmount)}
        </div>
        {state === 'paid' && p.note && (
          <div className='text-muted-foreground mt-1 text-sm'>{p.note}</div>
        )}
      </div>

      <section>
        <h3 className='text-muted-foreground mb-1 text-xs font-medium'>
          {t('howCostAddsUp')}
        </h3>
        <ul className='divide-border/60 divide-y'>
          {n(p.carriedOver) !== 0 && (
            <Line
              label={
                n(p.carriedOver) > 0
                  ? t('owedFromBefore')
                  : t('owedByThemFromBefore')
              }
              value={n(p.carriedOver)}
            />
          )}
          <Line
            label={
              <span className='inline-flex items-center gap-1'>
                {baseLabel}
                {p.termsChangedOn && <InfoTip>{t('payChangedHint')}</InfoTip>}
              </span>
            }
            detail={
              daily && n(p.paidOffDays) > 0
                ? t('inclPaidDaysOff', { count: n(p.paidOffDays) })
                : undefined
            }
            value={n(p.earned)}
          />
          {n(p.overtimePay) > 0 && (
            <Line
              label={t('overtimeHoursLine', { hours: n(p.overtimeHours) })}
              value={n(p.overtimePay)}
            />
          )}
          {n(p.absenceDeduction) > 0 && (
            <Line
              label={t('absentDaysLine', { count: n(p.absentDays) })}
              value={-n(p.absenceDeduction)}
            />
          )}
          {n(p.bonuses) > 0 && (
            <Line label={t('bonusesLine')} value={n(p.bonuses)}>
              {entriesOf(LEDGER_TYPE.bonus, p.bonuses)}
            </Line>
          )}
          {n(p.deductions) > 0 && (
            <Line label={t('deductionsLine')} value={-n(p.deductions)}>
              {entriesOf(LEDGER_TYPE.deduction, p.deductions)}
            </Line>
          )}
          {n(p.advances) > 0 && (
            <Line label={t('advancesTaken')} value={-n(p.advances)}>
              {entriesOf(LEDGER_TYPE.advance, p.advances)}
            </Line>
          )}
          {n(p.payments) > 0 && (
            <Line label={t('paidInPeriod')} value={-n(p.payments)}>
              {entriesOf(LEDGER_TYPE.payment, p.payments)}
            </Line>
          )}
          <li className='flex items-center justify-between gap-4 py-3 font-semibold'>
            <span>{t('payslipTotalLine')}</span>
            <Money value={p.amountDue} strong />
          </li>
          {state !== 'paid' && n(p.remaining) !== n(p.amountDue) && (
            <li className='flex items-center justify-between gap-4 py-3 font-semibold'>
              <span>{t('owedNowLine')}</span>
              <Money value={p.remaining} strong />
            </li>
          )}
        </ul>
      </section>

      {/* The month's days off: taken, allowed (with any carried in), and
          what carries on */}
      {n(p.daysOffAllowance) > 0 && (
        <p className='text-muted-foreground text-xs'>
          {t('daysOffBalance', {
            // Daily workers spend the allowance on paid days off, monthly
            // staff on days away
            used: String(
              Math.min(
                n(p.daysOffAllowance),
                n(p.paidOffDays) + n(p.absentDays)
              )
            ),
            allowance: String(n(p.daysOffAllowance)),
            unused: String(n(p.daysOffUnused)),
          })}
          {n(p.daysOffCarriedIn) > 0 &&
            ` (${t('daysOffCarriedIn', { days: String(n(p.daysOffCarriedIn)) })})`}
        </p>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// The payment: the amount still owed unless less was handed over, and a note

function PayDialog({
  payslip,
  monthLabel,
  onClose,
}: {
  payslip: PayslipView | null
  monthLabel: string
  onClose: () => void
}) {
  return (
    <Dialog open={payslip !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-md'>
        {/* Keyed so each payslip opens with its own fresh form */}
        {payslip && (
          <PayForm
            key={String(payslip.id)}
            payslip={payslip}
            monthLabel={monthLabel}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PayForm({
  payslip,
  monthLabel,
  onClose,
}: {
  payslip: PayslipView
  monthLabel: string
  onClose: () => void
}) {
  const t = useT()
  const { payPayslip, isPending } = usePayrollActions()
  const owed = Math.max(0, toNumber(payslip.remaining))
  const [amount, setAmount] = useState(String(owed))
  const [note, setNote] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await payPayslip(toNumber(payslip.id), {
        amount: parseFloat(amount),
        note: note.trim() || null,
      })
      onClose()
    } catch {
      // toasted by usePayrollActions
    }
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <DialogHeader>
        <DialogTitle>
          {t('payEmployee', { name: payslip.employeeName })}
        </DialogTitle>
        <DialogDescription>
          {t('payDialogLine', { month: monthLabel, amount: formatEgp(owed) })}
        </DialogDescription>
      </DialogHeader>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='pay-amount'>{t('amountPaid')}</Label>
          <Input
            id='pay-amount'
            type='number'
            min='0'
            step='any'
            inputMode='decimal'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='pay-note'>{t('note')}</Label>
          <Input
            id='pay-note'
            value={note}
            placeholder={t('payNoteHint')}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          type='submit'
          disabled={isPending || !(parseFloat(amount) >= 0)}
        >
          {isPending && <Spinner />}
          {t('confirmPayment')}
        </Button>
      </DialogFooter>
    </form>
  )
}
