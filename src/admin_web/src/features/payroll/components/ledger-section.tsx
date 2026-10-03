import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type EmployeeView } from '@/api/payroll'
import { formatDay } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { DatePicker } from '@/components/date-picker'
import { ErrorState } from '@/components/error-state'
import { Money } from '@/components/money'
import {
  LEDGER_SOURCE,
  LEDGER_TYPE,
  ledgerTypeLabel,
  MANUAL_LEDGER_TYPES,
  readableDay,
} from '../format'
import { ledgerQueryOptions } from '../queries'
import { usePayrollActions } from '../use-payroll-actions'

/**
 * What the business owes this person, line by line, newest first, and a form
 * to key in an advance, a payment, a bonus or a deduction. Earnings only
 * ever come from a payslip. Each line says what it was, when, and why;
 * who keyed it in is not the owner's question.
 */
export function LedgerSection({
  employee,
  showBalance = true,
}: {
  employee: EmployeeView
  /** Off where the page already shows what they are owed */
  showBalance?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const employeeId = toNumber(employee.id)
  const ledger = useQuery(ledgerQueryOptions(employeeId))
  const { postLedgerEntry, isPending } = usePayrollActions()

  const [adding, setAdding] = useState(false)
  const [type, setType] = useState(String(LEDGER_TYPE.advance))
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDay(new Date()))
  const [note, setNote] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postLedgerEntry(employeeId, {
        type: Number(type),
        amount: parseFloat(amount),
        date,
        note: note.trim() || null,
      })
      setAdding(false)
      setAmount('')
      setNote('')
    } catch {
      // toasted by usePayrollActions
    }
  }

  const balance = toNumber(ledger.data?.balance ?? employee.balance)

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        {showBalance ? (
          <div>
            <div className='text-muted-foreground text-xs'>
              {balance < 0 ? t('theyOwe') : t('owedToThem')}
            </div>
            <div
              className={cn(
                'text-lg font-semibold tabular-nums',
                balance < 0 && 'text-destructive'
              )}
            >
              {formatEgp(Math.abs(balance))}
            </div>
          </div>
        ) : (
          <span />
        )}
        {!adding && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setAdding(true)}
          >
            <Plus />
            {t('addLedgerEntry')}
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={submit}
          className='bg-muted/40 space-y-3 rounded-lg border p-3'
        >
          <div className='grid gap-3 sm:grid-cols-3'>
            <div className='flex flex-col gap-1.5'>
              <Label>{t('type')}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className='h-9 w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_LEDGER_TYPES.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {ledgerTypeLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='ledger-amount'>{t('amount')}</Label>
              <Input
                id='ledger-amount'
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
              <Label htmlFor='ledger-date'>{t('date')}</Label>
              <DatePicker
                id='ledger-date'
                value={date}
                onChange={setDate}
                disabled={(d) => d > new Date()}
              />
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='ledger-note'>{t('note')}</Label>
            <Input
              id='ledger-note'
              value={note}
              placeholder={t('ledgerNoteHint')}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setAdding(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={isPending || !(parseFloat(amount) > 0)}
            >
              {isPending && <Spinner />}
              {t('post')}
            </Button>
          </div>
        </form>
      )}

      {ledger.isError ? (
        <ErrorState
          size='section'
          error={ledger.error}
          onRetry={ledger.refetch}
        />
      ) : ledger.isLoading ? (
        <Skeleton className='h-24' />
      ) : (ledger.data?.entries.length ?? 0) === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('ledgerEmpty')}</p>
      ) : (
        <ul className='divide-border/60 divide-y text-sm'>
          {ledger.data!.entries.map((entry) => {
            const signed = toNumber(entry.signed)
            return (
              <li
                key={String(entry.id)}
                className='flex items-start justify-between gap-3 py-2.5'
              >
                <div className='min-w-0'>
                  <div className='font-medium'>
                    {ledgerTypeLabel(entry.type, t)}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {readableDay(entry.date, locale, t)}
                    {entry.note && ` · ${entry.note}`}
                    {toNumber(entry.source) === LEDGER_SOURCE.tillPayOut &&
                      ` · ${t('fromTill')}`}
                  </div>
                </div>
                <Money
                  value={signed}
                  signed
                  className={cn(
                    'shrink-0',
                    signed < 0 && 'text-muted-foreground'
                  )}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
