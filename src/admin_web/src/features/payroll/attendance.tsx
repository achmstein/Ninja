import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Umbrella,
  X,
} from 'lucide-react'
import { type AttendanceView, type EmployeeView } from '@/api/payroll'
import { formatDay } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Toggle } from '@/components/ui/toggle'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { InfoTip } from '@/components/info-tip'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ATTENDANCE, monthRange, PAY_SCHEME, schemeLabel } from './format'
import { attendanceQueryOptions, employeesQueryOptions } from './queries'
import { usePayrollActions } from './use-payroll-actions'

const route = getRouteApi('/_authenticated/payroll/attendance')

// A tap cycles a day: unmarked → present → half day → day off → absent → unmarked
const CYCLE: (number | null)[] = [
  null,
  ATTENDANCE.present,
  ATTENDANCE.halfDay,
  ATTENDANCE.dayOff,
  ATTENDANCE.absent,
]

/**
 * The month, one row per person, one cell per day. Tapping a cell marks
 * it; "everyone present today" fills the column. Days before someone
 * started, after they left, or still to come cannot be marked. With the
 * overtime toggle on, tapping a worked day asks for the extra hours
 * instead of cycling it.
 */
export function Attendance() {
  const t = useT()
  const locale = useLocale()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const queryClient = useQueryClient()
  const { markAttendance } = usePayrollActions()

  const today = formatDay(new Date())
  const [year, month] = (search.month ?? today.slice(0, 7))
    .split('-')
    .map(Number)
  const range = monthRange(year, month - 1)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const employees = useQuery(employeesQueryOptions(true))
  const attendanceOptions = attendanceQueryOptions(range.from, range.to)
  const attendance = useQuery(attendanceOptions)
  const [overtimeMode, setOvertimeMode] = useState(false)

  // Everyone employed on any day of the month, leavers included. The
  // compiler memoizes these; a manual useMemo over a query result trips
  // the query lint rule
  const rows = (employees.data ?? []).filter(
    (e) => e.startedOn <= range.to && (!e.endedOn || e.endedOn >= range.from)
  )

  const marks = new Map<string, AttendanceView>()
  for (const row of attendance.data ?? []) {
    marks.set(`${row.employeeId}/${row.date}`, row)
  }

  const days = Array.from({ length: range.days }, (_, i) => {
    const date = new Date(year, month - 1, i + 1)
    return { iso: formatDay(date), day: i + 1, date }
  })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    navigate({
      search: (prev) => ({
        ...prev,
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
      }),
    })
  }

  const canMark = (employee: EmployeeView, iso: string) =>
    iso <= today &&
    iso >= employee.startedOn &&
    (!employee.endedOn || iso <= employee.endedOn)

  const mark = async (
    date: string,
    changes: {
      employee: EmployeeView
      status: number | null
      overtimeHours?: number
    }[]
  ) => {
    // Paint first, then post; the refetch on success settles it
    queryClient.setQueryData(
      attendanceOptions.queryKey,
      (prev: AttendanceView[] | undefined) => {
        const kept = (prev ?? []).filter(
          (row) =>
            !(
              row.date === date &&
              changes.some(
                (c) => toNumber(c.employee.id) === toNumber(row.employeeId)
              )
            )
        )
        const added = changes
          .filter((c) => c.status !== null)
          .map<AttendanceView>((c) => ({
            employeeId: c.employee.id,
            date,
            branchId: c.employee.branchId,
            status: c.status!,
            overtimeHours:
              c.overtimeHours ??
              // Untouched hours stay; a day away has none
              (c.status === ATTENDANCE.present ||
              c.status === ATTENDANCE.halfDay
                ? toNumber(
                    marks.get(`${c.employee.id}/${date}`)?.overtimeHours ?? 0
                  )
                : 0),
            note: null,
            markedBy: '',
            markedAt: new Date().toISOString(),
          }))
        return [...kept, ...added]
      }
    )
    try {
      await markAttendance(date, {
        marks: changes.map((c) => ({
          employeeId: c.employee.id,
          status: c.status,
          overtimeHours: c.overtimeHours ?? null,
        })),
      })
    } catch {
      // toasted; the invalidation on settle restores the truth
      queryClient.invalidateQueries({ queryKey: attendanceOptions.queryKey })
    }
  }

  const cycle = (employee: EmployeeView, iso: string) => {
    const current = marks.get(`${employee.id}/${iso}`)?.status ?? null
    const next =
      CYCLE[
        (CYCLE.indexOf(current === null ? null : toNumber(current)) + 1) %
          CYCLE.length
      ]
    void mark(iso, [{ employee, status: next }])
  }

  const setOvertime = (employee: EmployeeView, iso: string, hours: number) => {
    const current = marks.get(`${employee.id}/${iso}`)
    if (!current) return
    void mark(iso, [
      { employee, status: toNumber(current.status), overtimeHours: hours },
    ])
  }

  const everyoneToday = () => {
    const unmarked = rows.filter(
      (e) => canMark(e, today) && !marks.has(`${e.id}/${today}`)
    )
    if (unmarked.length === 0) return
    void mark(
      today,
      unmarked.map((employee) => ({ employee, status: ATTENDANCE.present }))
    )
  }

  const todayInMonth = today >= range.from && today <= range.to

  return (
    <Main>
      <PageHeader
        title={t('navPayrollAttendance')}
        badge={
          <InfoTip>
            <p>{t('attendanceLegend')}</p>
            <p className='mt-2'>{t('monthlyGridHint')}</p>
            <p className='mt-2'>{t('overtimeModeHint')}</p>
          </InfoTip>
        }
        actions={
          rows.length > 0 ? (
            <div className='flex gap-2'>
              <Toggle
                variant='outline'
                pressed={overtimeMode}
                onPressedChange={setOvertimeMode}
                aria-label={t('overtimeMode')}
                title={t('overtimeModeHint')}
              >
                <Clock className='me-2 h-4 w-4' />
                {t('overtime')}
              </Toggle>
              {todayInMonth && (
                <Button size='sm' variant='outline' onClick={everyoneToday}>
                  <CalendarCheck className='me-2 h-4 w-4' />
                  {t('everyonePresentToday')}
                </Button>
              )}
            </div>
          ) : null
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

      {employees.isError ? (
        <ErrorState error={employees.error} onRetry={employees.refetch} />
      ) : !employees.isLoading && rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t('noEmployees')}
          action={
            <Button asChild>
              <Link to='/payroll/employees' search={{ new: true }}>
                {t('addEmployee')}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className='overflow-x-auto rounded-lg border'>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='bg-muted/40'>
                <th className='bg-muted/40 sticky start-0 z-10 min-w-40 border-e px-3 py-2 text-start font-medium'>
                  {t('employee')}
                </th>
                {days.map((d) => (
                  <th
                    key={d.iso}
                    className={cn(
                      'w-9 min-w-9 px-0 py-1 text-center font-normal',
                      d.iso === today && 'text-primary font-semibold'
                    )}
                  >
                    <div className='text-muted-foreground text-[10px] leading-none'>
                      {weekday.format(d.date)}
                    </div>
                    <div className='tabular-nums'>{d.day}</div>
                  </th>
                ))}
                <th className='min-w-14 px-2 py-2 text-end font-medium tabular-nums'>
                  {t('daysShort')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => {
                // Daily workers are paid per day marked worked; monthly staff
                // are marked when absent, so their number is the absences
                const monthly =
                  toNumber(
                    employee.currentTerms?.scheme ?? PAY_SCHEME.daily
                  ) === PAY_SCHEME.monthly
                const worked = days.reduce((sum, d) => {
                  const status = marks.get(`${employee.id}/${d.iso}`)?.status
                  if (status === undefined) return sum
                  const n = toNumber(status)
                  return (
                    sum +
                    (n === ATTENDANCE.present
                      ? 1
                      : n === ATTENDANCE.halfDay
                        ? 0.5
                        : 0)
                  )
                }, 0)
                const marked = days.filter((d) =>
                  marks.has(`${employee.id}/${d.iso}`)
                ).length
                const absent = marked - worked
                const offDays = days.filter(
                  (d) =>
                    toNumber(marks.get(`${employee.id}/${d.iso}`)?.status) ===
                    ATTENDANCE.dayOff
                ).length
                const overtime = days.reduce(
                  (sum, d) =>
                    sum +
                    toNumber(
                      marks.get(`${employee.id}/${d.iso}`)?.overtimeHours ?? 0
                    ),
                  0
                )
                return (
                  <tr key={String(employee.id)} className='border-t'>
                    <td className='bg-background sticky start-0 z-10 border-e px-3 py-1'>
                      <div className='truncate font-medium'>
                        {employee.name}
                      </div>
                      <div className='text-muted-foreground truncate text-xs'>
                        {employee.jobTitle || ''}
                        {monthly && (
                          <span> · {schemeLabel(PAY_SCHEME.monthly, t)}</span>
                        )}
                      </div>
                    </td>
                    {days.map((d) => {
                      const row = marks.get(`${employee.id}/${d.iso}`)
                      const status =
                        row === undefined ? null : toNumber(row.status)
                      const hours = toNumber(row?.overtimeHours ?? 0)
                      const enabled = canMark(employee, d.iso)
                      const worked =
                        status === ATTENDANCE.present ||
                        status === ATTENDANCE.halfDay
                      return (
                        <td key={d.iso} className='p-0.5 text-center'>
                          {overtimeMode && worked ? (
                            <OvertimePopover
                              hours={hours}
                              onSave={(h) => setOvertime(employee, d.iso, h)}
                            >
                              <DayCell
                                status={status}
                                hours={hours}
                                disabled={!enabled}
                                today={d.iso === today}
                              />
                            </OvertimePopover>
                          ) : (
                            <DayCell
                              status={status}
                              hours={hours}
                              disabled={!enabled || (overtimeMode && !worked)}
                              today={d.iso === today}
                              onClick={() => cycle(employee, d.iso)}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td
                      className={cn(
                        'px-2 py-1 text-end font-medium whitespace-nowrap tabular-nums',
                        monthly && absent > 0 && 'text-destructive'
                      )}
                    >
                      {monthly ? (
                        absent > 0 ? (
                          t('absentDaysCount', { days: String(absent) })
                        ) : (
                          '—'
                        )
                      ) : (
                        <>
                          {worked}
                          {offDays > 0 && (
                            <span className='text-muted-foreground font-normal'>
                              {' '}
                              +{offDays} {t('dayOffShort')}
                            </span>
                          )}
                        </>
                      )}
                      {overtime > 0 && (
                        <span className='text-muted-foreground block text-xs font-normal'>
                          +{overtime}
                          {t('hoursAbbr')} {t('overtimeShort')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Main>
  )
}

/**
 * The hours worked past the shift on one day. Saved as typed; zero clears
 * them.
 */
function OvertimePopover({
  hours,
  onSave,
  children,
}: {
  hours: number
  onSave: (hours: number) => void
  children: React.ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(hours))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const next = parseFloat(value)
    if (Number.isFinite(next) && next >= 0 && next <= 16) {
      onSave(next)
      setOpen(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(String(hours))
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className='w-48 p-3' align='center'>
        <form onSubmit={save} className='flex flex-col gap-2'>
          <Label htmlFor='overtime-hours'>{t('overtimeHours')}</Label>
          <div className='flex items-center gap-2'>
            <Input
              id='overtime-hours'
              type='number'
              min='0'
              max='16'
              step='0.5'
              inputMode='decimal'
              className='h-8'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <span className='text-muted-foreground text-sm'>
              {t('hoursAbbr')}
            </span>
          </div>
          <div className='flex justify-end gap-1'>
            {hours > 0 && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 px-2'
                onClick={() => {
                  onSave(0)
                  setOpen(false)
                }}
              >
                {t('clear')}
              </Button>
            )}
            <Button type='submit' size='sm' className='h-7 px-2'>
              {t('save')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function DayCell({
  status,
  hours = 0,
  disabled,
  today,
  onClick,
  ...rest
}: {
  status: number | null
  hours?: number
  disabled: boolean
  today: boolean
  onClick?: () => void
} & Omit<React.ComponentProps<'button'>, 'onClick'>) {
  const t = useT()
  const label =
    status === ATTENDANCE.present
      ? t('present')
      : status === ATTENDANCE.halfDay
        ? t('halfDay')
        : status === ATTENDANCE.dayOff
          ? t('dayOff')
          : status === ATTENDANCE.absent
            ? t('absent')
            : t('unmarked')
  return (
    <button
      type='button'
      {...rest}
      disabled={disabled}
      aria-label={hours > 0 ? `${label} +${hours}${t('hoursAbbr')}` : label}
      title={hours > 0 ? `${label} +${hours}${t('hoursAbbr')}` : label}
      onClick={onClick}
      className={cn(
        'relative mx-auto flex size-8 items-center justify-center rounded-md border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-30',
        status === null && 'hover:bg-accent border-dashed',
        status === ATTENDANCE.present &&
          'bg-success/15 border-success/40 text-success',
        status === ATTENDANCE.halfDay &&
          'bg-warning/15 border-warning/40 text-warning',
        status === ATTENDANCE.dayOff &&
          'bg-primary/10 border-primary/40 text-primary',
        status === ATTENDANCE.absent &&
          'bg-destructive/10 border-destructive/40 text-destructive',
        today && status === null && 'border-primary/50'
      )}
    >
      {status === ATTENDANCE.present && <Check className='h-4 w-4' />}
      {status === ATTENDANCE.halfDay && <Minus className='h-4 w-4' />}
      {status === ATTENDANCE.dayOff && <Umbrella className='h-4 w-4' />}
      {status === ATTENDANCE.absent && <X className='h-4 w-4' />}
      {hours > 0 && (
        <span className='bg-primary text-primary-foreground absolute -end-1 -top-1 rounded-full px-1 text-[9px] leading-3 font-semibold tabular-nums'>
          +{hours}
        </span>
      )}
    </button>
  )
}
