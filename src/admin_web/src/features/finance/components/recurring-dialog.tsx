import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type RecurringExpenseView } from '@/api/finance'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('recurringBills')}</DialogTitle>
        </DialogHeader>

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
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-8 px-2'
              onClick={() => setEditing('new')}
            >
              <Plus className='me-1 h-3.5 w-3.5' />
              {t('addRecurringBill')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
    <form onSubmit={submit} className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('expenseCategory')}</Label>
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
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='rec-amount'>{t('amount')}</Label>
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
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='rec-day'>{t('dayOfMonth')}</Label>
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
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('paidFrom')}</Label>
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
        </div>
        {fromPartner && (
          <div className='flex flex-col gap-1.5 sm:col-span-2'>
            <Label>{t('whichPartner')}</Label>
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
          </div>
        )}
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='rec-vendor'>{t('vendor')}</Label>
          <Input
            id='rec-vendor'
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='rec-note'>{t('note')}</Label>
          <Input
            id='rec-note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className='flex items-center justify-between gap-2'>
        {bill ? (
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            {t('active')}
          </label>
        ) : (
          <span />
        )}
        <div className='flex gap-2'>
          <Button type='button' variant='ghost' size='sm' onClick={onDone}>
            {t('cancel')}
          </Button>
          <Button type='submit' size='sm' disabled={!canSubmit || isPending}>
            {isPending && <Spinner className='me-2' />}
            {t('save')}
          </Button>
        </div>
      </div>
    </form>
  )
}
