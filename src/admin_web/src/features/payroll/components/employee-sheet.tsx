import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isOwner } from '@/config/oidc-config'
import { KeyRound } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { type EmployeeView } from '@/api/payroll'
import { getEmployeeOptions } from '@/api/payroll/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { API_VERSION } from '@/lib/api-client'
import { formatDay } from '@/lib/business-day'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Section } from '@/components/section'
import { InfoTip } from '@/components/info-tip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Combobox } from '@/components/combobox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DatePicker } from '@/components/date-picker'
import { customersService } from '@/features/customers/services/customers-service'
import { getCustomerDisplayName } from '@/features/customers/types'
import { AddStaffDialog } from '@/features/staff/components/add-staff-dialog'
import { PAY_SCHEME, payLabel, schemeLabel } from '../format'
import { usePayrollActions } from '../use-payroll-actions'
import { LedgerSection } from './ledger-section'

type EmployeeSheetProps = {
  employeeId: number | null
  isNew: boolean
  onClose: () => void
}

/**
 * One employee: who they are, how they are paid (dated, with history), the
 * ledger of what they are owed, and whether they still work here. A new
 * employee is hired with their first pay terms in the same form.
 */
export function EmployeeSheet({
  employeeId,
  isNew,
  onClose,
}: EmployeeSheetProps) {
  const t = useT()
  const open = isNew || employeeId !== null

  const employee = useQuery({
    ...getEmployeeOptions({
      path: { id: employeeId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: employeeId !== null,
  })

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {isNew ? t('addEmployee') : (employee.data?.name ?? '…')}
          </SheetTitle>
        </SheetHeader>

        {isNew ? (
          <Section title={t('details')}>
            <EmployeeForm key='new' employee={null} onSaved={onClose} />
          </Section>
        ) : employee.data ? (
          <>
            <Section title={t('details')}>
              <EmployeeForm
                key={String(employee.data.id)}
                employee={employee.data}
                onSaved={() => {}}
              />
            </Section>
            <Section title={t('pay')}>
              <PayTermsSection employee={employee.data} />
            </Section>
            <Section title={t('ledger')}>
              <LedgerSection employee={employee.data} />
            </Section>
            <Section title={t('employment')}>
              <EmploymentSection employee={employee.data} />
            </Section>
          </>
        ) : (
          <div className='space-y-3 p-4'>
            <Skeleton className='h-9' />
            <Skeleton className='h-9' />
            <Skeleton className='h-9' />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}


// ---------------------------------------------------------------------------
// Who they are (and, for a new hire, what they start on)

function EmployeeForm({
  employee,
  onSaved,
}: {
  employee: EmployeeView | null
  onSaved: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  // Making a login is the owner's call, like on the accounts page
  const owner = isOwner(auth.user)
  const { hire, update, isPending } = usePayrollActions()
  const activeBranchId = useBranchStore((s) => s.branchId)
  const { branches } = useAllowedBranches()
  const [creatingLogin, setCreatingLogin] = useState(false)

  const [name, setName] = useState(employee?.name ?? '')
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [branchId, setBranchId] = useState(
    String(employee?.branchId ?? activeBranchId ?? '')
  )
  const [userId, setUserId] = useState<string | null>(employee?.userId ?? null)
  const [startedOn, setStartedOn] = useState(formatDay(new Date()))
  const [scheme, setScheme] = useState(String(PAY_SCHEME.daily))
  const [rate, setRate] = useState('')
  const [paidDaysOff, setPaidDaysOff] = useState(
    String(employee?.paidDaysOff ?? 4)
  )

  // Staff accounts, for linking a login. Everyone with a staff role; the
  // ones already linked to someone else are refused by the API.
  const accounts = useQuery({
    queryKey: ['staff'],
    queryFn: () =>
      customersService.getCustomers({ role: 'Admin,Owner,Cashier', max: 200 }),
  })
  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: getCustomerDisplayName(account),
    hint: account.email,
  }))

  const common = {
    name: name.trim(),
    jobTitle: jobTitle.trim() || null,
    phone: phone.trim() || null,
    branchId: Number(branchId),
    userId,
    paidDaysOff: Number(paidDaysOff),
  }

  // A login made from here is linked at once: for someone on the register
  // it is saved straight away, for a new hire it goes in with the hire
  const linkNewLogin = async (newUserId: string) => {
    setUserId(newUserId)
    if (employee) {
      try {
        await update(toNumber(employee.id), { ...common, userId: newUserId })
      } catch {
        // toasted by usePayrollActions; the combobox still shows the pick
      }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (employee) {
        await update(toNumber(employee.id), common)
      } else {
        await hire({
          ...common,
          startedOn,
          scheme: Number(scheme),
          rate: parseFloat(rate),
        })
      }
      onSaved()
    } catch {
      // toasted by usePayrollActions
    }
  }

  const canSubmit =
    name.trim() !== '' &&
    branchId !== '' &&
    (employee !== null || parseFloat(rate) > 0)

  return (
    <form onSubmit={submit} className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5 sm:col-span-2'>
          <Label htmlFor='emp-name'>{t('name')}</Label>
          <Input
            id='emp-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!employee}
            required
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='emp-job'>{t('jobTitle')}</Label>
          <Input
            id='emp-job'
            value={jobTitle}
            placeholder={t('jobTitleHint')}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='emp-phone'>{t('phone')}</Label>
          <Input
            id='emp-phone'
            value={phone}
            inputMode='tel'
            dir='ltr'
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('homeBranch')}</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className='h-9 w-full'>
              <SelectValue placeholder={t('branches')} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={String(branch.id)} value={String(branch.id)}>
                  {localized(branch.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('login')}</Label>
          <div className='flex gap-2'>
            <Combobox
              value={userId}
              onChange={setUserId}
              options={accountOptions}
              placeholder={t('noLogin')}
              clearLabel={t('noLogin')}
              size='sm'
              className='min-w-0 flex-1'
            />
            {owner && !userId && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='shrink-0'
                title={t('createLoginHint')}
                onClick={() => setCreatingLogin(true)}
              >
                <KeyRound className='me-2 h-4 w-4' />
                {t('createLogin')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {creatingLogin && (
        <AddStaffDialog
          open
          onOpenChange={(open) => !open && setCreatingLogin(false)}
          defaults={{
            name: name.trim(),
            branchIds: branchId ? [Number(branchId)] : [],
            role: 'Cashier',
          }}
          onCreated={(id) => void linkNewLogin(id)}
        />
      )}

      {!employee && (
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='emp-started'>{t('startedOn')}</Label>
            <DatePicker
              id='emp-started'
              value={startedOn}
              onChange={setStartedOn}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label>{t('payScheme')}</Label>
            <Select value={scheme} onValueChange={setScheme}>
              <SelectTrigger className='h-9 w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(PAY_SCHEME.daily)}>
                  {schemeLabel(PAY_SCHEME.daily, t)}
                </SelectItem>
                <SelectItem value={String(PAY_SCHEME.monthly)}>
                  {schemeLabel(PAY_SCHEME.monthly, t)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='emp-rate'>
              {Number(scheme) === PAY_SCHEME.daily
                ? t('ratePerDay')
                : t('salaryPerMonth')}
            </Label>
            <Input
              id='emp-rate'
              type='number'
              min='0'
              step='any'
              inputMode='decimal'
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* Paid days off: a daily worker's agreed day off is paid within it,
          a monthly employee's days away beyond it cost a day each */}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='emp-days-off'>{t('paidDaysOff')}</Label>
          <Input
            id='emp-days-off'
            type='number'
            min='0'
            max='31'
            step='1'
            inputMode='numeric'
            value={paidDaysOff}
            onChange={(e) => setPaidDaysOff(e.target.value)}
            required
          />
        </div>
        <InfoTip className='self-end'>{t('paidDaysOffHint')}</InfoTip>
      </div>

      <div className='flex justify-end'>
        <Button type='submit' disabled={!canSubmit || isPending}>
          {isPending && <Spinner className='me-2' />}
          {employee ? t('save') : t('addEmployee')}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// How they are paid: the terms in force, the history, a dated change

function PayTermsSection({ employee }: { employee: EmployeeView }) {
  const t = useT()
  const auth = useAuth()
  // Changing pay is the owner's call; a manager sees it, not the button
  const owner = isOwner(auth.user)
  const { setPayTerms, isPending } = usePayrollActions()
  const [editing, setEditing] = useState(false)
  const [scheme, setScheme] = useState(
    String(employee.currentTerms?.scheme ?? PAY_SCHEME.daily)
  )
  const [rate, setRate] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(formatDay(new Date()))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await setPayTerms(toNumber(employee.id), {
        scheme: Number(scheme),
        rate: parseFloat(rate),
        effectiveFrom,
      })
      setEditing(false)
      setRate('')
    } catch {
      // toasted by usePayrollActions
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-lg font-semibold tabular-nums'>
          {payLabel(employee.currentTerms, t)}
        </span>
        {!editing && owner && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setEditing(true)}
          >
            {t('changePay')}
          </Button>
        )}
      </div>

      {editing && (
        <form
          onSubmit={submit}
          className='bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end'
        >
          <div className='flex flex-col gap-1.5'>
            <Label>{t('payScheme')}</Label>
            <Select value={scheme} onValueChange={setScheme}>
              <SelectTrigger className='h-9 w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(PAY_SCHEME.daily)}>
                  {schemeLabel(PAY_SCHEME.daily, t)}
                </SelectItem>
                <SelectItem value={String(PAY_SCHEME.monthly)}>
                  {schemeLabel(PAY_SCHEME.monthly, t)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='terms-rate'>
              {Number(scheme) === PAY_SCHEME.daily
                ? t('ratePerDay')
                : t('salaryPerMonth')}
            </Label>
            <Input
              id='terms-rate'
              type='number'
              min='0'
              step='any'
              inputMode='decimal'
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='terms-from'>{t('effectiveFrom')}</Label>
            <DatePicker
              id='terms-from'
              value={effectiveFrom}
              onChange={setEffectiveFrom}
            />
          </div>
          <div className='flex h-9 items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setEditing(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={isPending || !(parseFloat(rate) > 0)}
            >
              {isPending && <Spinner className='me-2' />}
              {t('save')}
            </Button>
          </div>
        </form>
      )}

      {employee.terms.length > 1 && (
        <ul className='text-muted-foreground divide-y text-xs'>
          {employee.terms.map((terms) => (
            <li
              key={terms.effectiveFrom}
              className='flex justify-between py-1 tabular-nums'
            >
              <span>{t('fromDate', { date: terms.effectiveFrom })}</span>
              <span>{payLabel(terms, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Still here, or left on a date

function EmploymentSection({ employee }: { employee: EmployeeView }) {
  const t = useT()
  const { leave, rehire, isPending } = usePayrollActions()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [date, setDate] = useState(formatDay(new Date()))

  const confirm = async () => {
    try {
      if (employee.isActive) await leave(toNumber(employee.id), date)
      else await rehire(toNumber(employee.id), date)
      setLeaveOpen(false)
    } catch {
      // toasted by usePayrollActions
    }
  }

  return (
    <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
      <span className='text-muted-foreground'>
        {employee.isActive
          ? t('workingSince', { date: employee.startedOn })
          : t('leftOn', { date: employee.endedOn ?? '' })}
        {' · '}
        {toNumber(employee.balance) < 0
          ? `${formatEgp(-toNumber(employee.balance))} ${t('owesShort')}`
          : `${formatEgp(employee.balance)} ${t('owedShort')}`}
      </span>
      <Button
        type='button'
        variant={employee.isActive ? 'ghost' : 'outline'}
        size='sm'
        className={employee.isActive ? 'text-muted-foreground' : undefined}
        onClick={() => setLeaveOpen(true)}
      >
        {employee.isActive ? t('markLeft') : t('rehire')}
      </Button>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        destructive={employee.isActive}
        title={employee.isActive ? t('markLeftQuestion') : t('rehireQuestion')}
        desc={
          <div className='space-y-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='employment-date'>
                {employee.isActive ? t('lastDay') : t('startedOn')}
              </Label>
              <DatePicker
                id='employment-date'
                value={date}
                onChange={setDate}
              />
            </div>
          </div>
        }
        confirmText={employee.isActive ? t('markLeft') : t('rehire')}
        isLoading={isPending}
        handleConfirm={confirm}
      />
    </div>
  )
}
