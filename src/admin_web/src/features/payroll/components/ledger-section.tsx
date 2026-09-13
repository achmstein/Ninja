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
import {
  formatSignedEgp,
  LEDGER_SOURCE,
  LEDGER_TYPE,
  ledgerTypeLabel,
  MANUAL_LEDGER_TYPES,
} from '../format'
import { ledgerQueryOptions } from '../queries'
import { usePayrollActions } from '../use-payroll-actions'

/**
 * What the café owes this person, line by line, newest first, and a form
 * to key in an advance, a payment, a bonus or a deduction. Earnings only
 * ever come from a payslip.
 */
export function LedgerSection({ employee }: { employee: EmployeeView }) {
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

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

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
        <div>
          <div className='text-muted-foreground text-xs'>
            {balance < 0 ? t('owes') : t('owed')}
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
        {!adding && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setAdding(true)}
          >
            <Plus className='me-2 h-4 w-4' />
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
              {isPending && <Spinner className='me-2' />}
              {t('post')}
            </Button>
          </div>
        </form>
      )}

      {ledger.isLoading ? (
        <Skeleton className='h-24' />
      ) : (ledger.data?.entries.length ?? 0) === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('ledgerEmpty')}</p>
      ) : (
        <ul className='divide-y text-sm'>
          {ledger.data!.entries.map((entry) => {
            const signed = toNumber(entry.signed)
            return (
              <li
                key={String(entry.id)}
                className='flex items-start justify-between gap-3 py-2'
              >
                <div className='min-w-0'>
                  <div className='font-medium'>
                    {ledgerTypeLabel(entry.type, t)}
                    {entry.note && (
                      <span className='text-muted-foreground font-normal'>
                        {' '}
                        · {entry.note}
                      </span>
                    )}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {dateFormat.format(new Date(entry.date))} ·{' '}
                    {toNumber(entry.source) === LEDGER_SOURCE.tillPayOut
                      ? t('fromTill')
                      : entry.recordedBy}
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    signed > 0 ? 'text-success' : 'text-muted-foreground'
                  )}
                >
                  {formatSignedEgp(signed)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
