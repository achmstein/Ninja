import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { type PayslipView } from '@/api/payroll'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { InfoTip } from '@/components/info-tip'
import { Badge } from '@/components/ui/badge'
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
import { Stat, StatStrip } from '@/components/stat-strip'
import { monthRange, PAY_SCHEME, PAYSLIP_STATUS, schemeLabel } from './format'
import { payslipsQueryOptions } from './queries'
import { usePayrollActions } from './use-payroll-actions'

const route = getRouteApi('/_authenticated/payroll/payslips')

/**
 * How the period was paid, in words: "22 days × 120" (plus paid days off),
 * "Monthly", or "pay changed on the 13th" when the month straddles a change
 * and no single rate describes it.
 */
function payDescription(
  p: Pick<
    PayslipView,
    'scheme' | 'rate' | 'daysWorked' | 'paidOffDays' | 'termsChangedOn'
  >,
  t: ReturnType<typeof useT>
): string {
  if (p.termsChangedOn) {
    return t('payChangedOn', { date: p.termsChangedOn })
  }
  if (toNumber(p.scheme) !== PAY_SCHEME.daily) {
    return schemeLabel(p.scheme, t)
  }
  const paidDays = toNumber(p.daysWorked) + toNumber(p.paidOffDays)
  const base = t('daysAtRate', {
    days: String(paidDays),
    rate: formatEgp(p.rate),
  })
  return toNumber(p.paidOffDays) > 0
    ? `${base} (${t('paidOffDaysCount', { days: String(toNumber(p.paidOffDays)) })})`
    : base
}

/**
 * A month's payslips for the branch: generate them for everyone, read the
 * breakdown, pay. A draft can be refreshed after attendance is corrected
 * or dropped; a paid one is history.
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
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))

  const payslips = useQuery(payslipsQueryOptions(range.from, range.to))
  const [paying, setPaying] = useState<PayslipView | null>(null)
  const [deleting, setDeleting] = useState<PayslipView | null>(null)

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    navigate({
      search: (prev) => ({
        ...prev,
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
      }),
    })
  }

  const generate = (employeeId?: number) =>
    generatePayslips({
      employeeId: employeeId ?? null,
      periodStart: range.from,
      periodEnd: range.to,
    }).catch(() => {
      // toasted by usePayrollActions
    })

  const rows = payslips.data ?? []
  const totalDue = rows
    .filter((p) => toNumber(p.status) === PAYSLIP_STATUS.draft)
    .reduce((sum, p) => sum + Math.max(0, toNumber(p.remaining)), 0)
  const totalPaid = rows
    .filter((p) => toNumber(p.status) === PAYSLIP_STATUS.paid)
    .reduce((sum, p) => sum + toNumber(p.paidAmount ?? 0), 0)
  const totalEarned = rows.reduce(
    (sum, p) => sum + toNumber(p.earned) + toNumber(p.overtimePay),
    0
  )

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
      <Main className='flex flex-col gap-6'>
        <PageHeader
          title={t('navPayrollPayslips')}
          actions={
            <div className='flex gap-2'>
              <ExportButton onExport={exportCsv} disabled={rows.length === 0} />
              <Button onClick={() => generate()} disabled={isPending}>
                {isPending ? (
                  <Spinner className='me-2' />
                ) : (
                  <FileText className='me-2 h-4 w-4' />
                )}
                {rows.length > 0 ? t('refreshPayslips') : t('generatePayslips')}
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

        {rows.length > 0 && (
          <StatStrip>
            <Stat label={t('earnedTotal')} value={formatEgp(totalEarned)} />
            <Stat
              label={t('dueTotal')}
              value={formatEgp(totalDue)}
              tone={totalDue > 0 ? 'warning' : 'default'}
            />
            <Stat label={t('paidTotal')} value={formatEgp(totalPaid)} />
          </StatStrip>
        )}

        {payslips.isError ? (
          <ErrorState error={payslips.error} onRetry={payslips.refetch} />
        ) : payslips.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('noPayslips')}
            action={
              <Button onClick={() => generate()} disabled={isPending}>
                <FileText className='me-2 h-4 w-4' />
                {t('generatePayslips')}
              </Button>
            }
          />
        ) : (
          <div className='overflow-x-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employee')}</TableHead>
                  <TableHead>{t('pay')}</TableHead>
                  <TableHead className='text-end'>
                    {t('ledgerEarned')}
                  </TableHead>
                  <TableHead className='text-end'>{t('adjustments')}</TableHead>
                  <TableHead className='text-end'>{t('carriedOver')}</TableHead>
                  <TableHead className='text-end'>
                    {t('paidInPeriod')}
                  </TableHead>
                  <TableHead className='text-end'>
                    {t('remainingToPay')}
                  </TableHead>
                  <TableHead />
                  <TableHead className='w-0' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const paid = toNumber(p.status) === PAYSLIP_STATUS.paid
                  const adjustments =
                    toNumber(p.overtimePay) +
                    toNumber(p.bonuses) -
                    toNumber(p.deductions) -
                    toNumber(p.absenceDeduction) -
                    toNumber(p.advances)
                  return (
                    <TableRow key={String(p.id)}>
                      <TableCell className='font-medium'>
                        {p.employeeName}
                      </TableCell>
                      <TableCell className='text-muted-foreground tabular-nums'>
                        {payDescription(p, t)}
                        {toNumber(p.overtimeHours) > 0 && (
                          <span>
                            {' '}
                            · +{toNumber(p.overtimeHours)}
                            {t('hoursAbbr')} {t('overtimeShort')}
                          </span>
                        )}
                        {toNumber(p.absentDays) > 0 && (
                          <span className='text-destructive'>
                            {' '}
                            ·{' '}
                            {t('absentDaysCount', {
                              days: String(toNumber(p.absentDays)),
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatEgp(p.earned)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-end tabular-nums',
                          adjustments < 0 && 'text-destructive'
                        )}
                      >
                        {adjustments === 0 ? '—' : formatEgp(adjustments)}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-end tabular-nums'>
                        {toNumber(p.carriedOver) === 0
                          ? '—'
                          : formatEgp(p.carriedOver)}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-end tabular-nums'>
                        {toNumber(p.payments) === 0
                          ? '—'
                          : formatEgp(p.payments)}
                      </TableCell>
                      <TableCell className='text-end font-semibold tabular-nums'>
                        {formatEgp(p.remaining)}
                      </TableCell>
                      <TableCell>
                        {paid ? (
                          <Badge variant='secondary' className='font-normal'>
                            {t('paidOn', {
                              date: p.paidAt
                                ? new Intl.DateTimeFormat(locale, {
                                    dateStyle: 'medium',
                                  }).format(new Date(p.paidAt))
                                : '',
                            })}
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='font-normal'>
                            {t('draft')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!paid && (
                          <div className='flex justify-end gap-1'>
                            <Button
                              size='sm'
                              onClick={() => setPaying(p)}
                              disabled={isPending}
                            >
                              <Banknote className='me-2 h-4 w-4' />
                              {t('pay')}
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground size-8'
                              aria-label={t('refreshPayslip')}
                              title={t('refreshPayslip')}
                              disabled={isPending}
                              onClick={() => generate(toNumber(p.employeeId))}
                            >
                              <RefreshCw className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground size-8'
                              aria-label={t('deletePayslip')}
                              title={t('deletePayslip')}
                              disabled={isPending}
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Main>

      <PayDialog payslip={paying} onClose={() => setPaying(null)} />

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
          } catch {
            // toasted by usePayrollActions
          }
        }}
      />
    </>
  )
}

/**
 * The breakdown behind the amount, and the payment itself: the amount
 * due unless the manager paid part of it, plus a note.
 */
function PayDialog({
  payslip,
  onClose,
}: {
  payslip: PayslipView | null
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
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PayForm({
  payslip,
  onClose,
}: {
  payslip: PayslipView
  onClose: () => void
}) {
  const t = useT()
  const { payPayslip, isPending } = usePayrollActions()
  const [amount, setAmount] = useState(
    String(Math.max(0, toNumber(payslip.remaining)))
  )
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

  const line = (label: string, value: number, muted = false) => (
    <div
      className={cn(
        'flex justify-between py-1',
        muted && 'text-muted-foreground'
      )}
    >
      <span>{label}</span>
      <span className='tabular-nums'>{formatEgp(value)}</span>
    </div>
  )

  return (
    <form onSubmit={submit} className='space-y-4'>
      <DialogHeader>
        <DialogTitle>
          {t('payEmployee', { name: payslip.employeeName })}
        </DialogTitle>
        <DialogDescription>
          {payslip.periodStart} – {payslip.periodEnd}
        </DialogDescription>
      </DialogHeader>

      <div className='divide-y text-sm'>
        {toNumber(payslip.carriedOver) !== 0 &&
          line(t('carriedOver'), toNumber(payslip.carriedOver), true)}
        {line(
          toNumber(payslip.scheme) === PAY_SCHEME.daily ||
            payslip.termsChangedOn
            ? payDescription(payslip, t)
            : t('ledgerEarned'),
          toNumber(payslip.earned)
        )}
        {payslip.termsChangedOn && (
          <div className='flex justify-end py-1'>
            <InfoTip>{t('payChangedHint')}</InfoTip>
          </div>
        )}
        {toNumber(payslip.overtimePay) > 0 &&
          line(
            `${t('overtimePay')} (${toNumber(payslip.overtimeHours)}${t('hoursAbbr')})`,
            toNumber(payslip.overtimePay)
          )}
        {toNumber(payslip.absenceDeduction) > 0 &&
          line(
            `${t('absenceDeduction')} (${t('absentDaysCount', { days: String(toNumber(payslip.absentDays)) })})`,
            -toNumber(payslip.absenceDeduction)
          )}
        {/* The month's days off: taken, allowed (with any carried in), and
            what carries on */}
        <p className='text-muted-foreground py-1 text-xs'>
          {t('daysOffBalance', {
            // Daily workers spend the allowance on paid days off, monthly
            // staff on days away
            used: String(
              Math.min(
                toNumber(payslip.daysOffAllowance),
                toNumber(payslip.paidOffDays) + toNumber(payslip.absentDays)
              )
            ),
            allowance: String(toNumber(payslip.daysOffAllowance)),
            unused: String(toNumber(payslip.daysOffUnused)),
          })}
          {toNumber(payslip.daysOffCarriedIn) > 0 &&
            ` (${t('daysOffCarriedIn', { days: String(toNumber(payslip.daysOffCarriedIn)) })})`}
        </p>
        {toNumber(payslip.bonuses) > 0 &&
          line(t('ledgerBonus'), toNumber(payslip.bonuses))}
        {toNumber(payslip.deductions) > 0 &&
          line(t('ledgerDeduction'), -toNumber(payslip.deductions))}
        {toNumber(payslip.advances) > 0 &&
          line(t('advancesTaken'), -toNumber(payslip.advances))}
        {toNumber(payslip.payments) > 0 &&
          line(t('paidInPeriod'), -toNumber(payslip.payments))}
        <div className='flex justify-between py-2 font-semibold'>
          <span>{t('amountDue')}</span>
          <span className='tabular-nums'>{formatEgp(payslip.amountDue)}</span>
        </div>
        {toNumber(payslip.remaining) !== toNumber(payslip.amountDue) && (
          <div className='space-y-1 py-2'>
            <div className='flex justify-between font-semibold'>
              <span>{t('remainingToPay')}</span>
              <span className='tabular-nums'>
                {formatEgp(payslip.remaining)}
              </span>
            </div>
          </div>
        )}
      </div>

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
          {isPending && <Spinner className='me-2' />}
          {t('confirmPayment')}
        </Button>
      </DialogFooter>
    </form>
  )
}
