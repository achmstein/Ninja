import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type RecurringExpenseView } from '@/api/finance'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid, SwitchRow } from '@/components/field'
import { PAID_FROM, paidFromLabel } from '../format'
import {
  categoriesQueryOptions,
  partnersQueryOptions,
  recurringQueryOptions,
} from '../queries'
import { useFinanceActions } from '../use-finance-actions'

/**
 * The bills that come every month on the same day. Finance posts each one
 * itself when its day arrives; switching one off stops the next without
 * touching what was already posted.
 */
export function RecurringDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const bills = useQuery({ ...recurringQueryOptions(), enabled: open })
  const [editing, setEditing] = useState<RecurringExpenseView | 'new' | null>(
    null
  )

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('recurringBills')}
    >
      {editing ? (
        <RecurringForm
          key={editing === 'new' ? 'new' : String(editing.id)}
          bill={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : bills.isLoading ? (
        <Skeleton className='h-32' />
      ) : (
        <div className='space-y-3'>
          {(bills.data ?? []).length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {t('noRecurringBills')}
            </p>
          ) : (
            <ul className='divide-y text-sm'>
              {bills.data!.map((bill) => (
                <li key={String(bill.id)}>
                  <button
                    type='button'
                    className='flex w-full items-center justify-between gap-3 py-2 text-start hover:underline'
                    onClick={() => setEditing(bill)}
                  >
                    <span
                      className={cn(
                        'min-w-0',
                        !bill.isActive && 'text-muted-foreground line-through'
                      )}
                    >
                      <span className='font-medium'>
                        {localized(bill.categoryName)}
                      </span>
                      {bill.vendor && (
                        <span className='text-muted-foreground'>
                          {' '}
                          · {bill.vendor}
                        </span>
                      )}
                      <span className='text-muted-foreground block text-xs'>
                        {t('onDayOfMonth', {
                          day: String(toNumber(bill.dayOfMonth)),
                        })}{' '}
                        · {paidFromLabel(bill.paidFrom, t)}
                        {bill.partnerName ? ` (${bill.partnerName})` : ''}
                      </span>
                    </span>
                    <span className='shrink-0 tabular-nums'>
                      {formatEgp(bill.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <SheetActions>
            <Button type='button' onClick={() => setEditing('new')}>
              <Plus />
              {t('addRecurringBill')}
            </Button>
          </SheetActions>
        </div>
      )}
    </EntitySheet>
  )
}

function RecurringForm({
  bill,
  onDone,
}: {
  bill: RecurringExpenseView | null
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const { saveRecurring, isPending } = useFinanceActions()
  const categories = useQuery(categoriesQueryOptions())
  const partners = useQuery(partnersQueryOptions())

  const [categoryId, setCategoryId] = useState(
    bill ? String(bill.categoryId) : ''
  )
  const [amount, setAmount] = useState(
    bill ? String(toNumber(bill.amount)) : ''
  )
  const [day, setDay] = useState(bill ? String(toNumber(bill.dayOfMonth)) : '1')
  const [paidFrom, setPaidFrom] = useState(
    String(bill ? toNumber(bill.paidFrom) : PAID_FROM.drawer)
  )
  const [partnerId, setPartnerId] = useState(
    bill?.partnerId != null ? String(toNumber(bill.partnerId)) : ''
  )
  const [vendor, setVendor] = useState(bill?.vendor ?? '')
  const [note, setNote] = useState(bill?.note ?? '')
  const [isActive, setIsActive] = useState(bill?.isActive ?? true)

  const fromPartner = Number(paidFrom) === PAID_FROM.partner
  const dayNumber = Number(day)
  const canSubmit =
    categoryId !== '' &&
    parseFloat(amount) > 0 &&
    dayNumber >= 1 &&
    dayNumber <= 28 &&
    (!fromPartner || partnerId !== '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveRecurring({
        id: bill ? toNumber(bill.id) : null,
        categoryId: Number(categoryId),
        amount: parseFloat(amount),
        dayOfMonth: dayNumber,
        paidFrom: Number(paidFrom),
        partnerId: fromPartner ? Number(partnerId) : null,
        vendor: vendor.trim() || null,
        note: note.trim() || null,
        isActive,
      })
      onDone()
    } catch {
      // toasted by useFinanceActions
    }
  }

  return (
    <form id='recurring-form' onSubmit={submit} className='space-y-4'>
      <FieldGrid>
        <Field label={t('expenseCategory')}>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className='h-9 w-full'>
              <SelectValue placeholder={t('pickCategory')} />
            </SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={String(c.id)} value={String(c.id)}>
                  {localized(c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('amount')} htmlFor='rec-amount'>
          <Input
            id='rec-amount'
            type='number'
            min='0'
            step='any'
            inputMode='decimal'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={!bill}
            required
          />
        </Field>
        <Field label={t('dayOfMonth')} htmlFor='rec-day'>
          <Input
            id='rec-day'
            type='number'
            min='1'
            max='28'
            step='1'
            inputMode='numeric'
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </Field>
        <Field label={t('paidFrom')}>
          <Select value={paidFrom} onValueChange={setPaidFrom}>
            <SelectTrigger className='h-9 w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[PAID_FROM.drawer, PAID_FROM.bank, PAID_FROM.partner].map(
                (v) => (
                  <SelectItem key={v} value={String(v)}>
                    {paidFromLabel(v, t)}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </Field>
        {fromPartner && (
          <Field label={t('whichPartner')} className='sm:col-span-2'>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className='h-9 w-full'>
                <SelectValue placeholder={t('whichPartner')} />
              </SelectTrigger>
              <SelectContent>
                {(partners.data ?? []).map((p) => (
                  <SelectItem key={String(p.id)} value={String(toNumber(p.id))}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label={t('vendor')} htmlFor='rec-vendor'>
          <Input
            id='rec-vendor'
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </Field>
        <Field label={t('note')} htmlFor='rec-note'>
          <Input
            id='rec-note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </FieldGrid>

      {bill && (
        <SwitchRow
          title={t('active')}
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      )}

      <SheetActions>
        <Button type='button' variant='outline' onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button
          type='submit'
          form='recurring-form'
          disabled={!canSubmit || isPending}
        >
          {isPending && <Spinner />}
          {t('save')}
        </Button>
      </SheetActions>
    </form>
  )
}
