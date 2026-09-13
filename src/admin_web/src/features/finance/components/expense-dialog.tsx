import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { formatDay } from '@/lib/business-day'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DatePicker } from '@/components/date-picker'
import { PAID_FROM, paidFromLabel } from '../format'
import { categoriesQueryOptions, partnersQueryOptions } from '../queries'
import { pickedReceipt, RECEIPT_ACCEPT } from '../receipts'
import { useFinanceActions } from '../use-finance-actions'

/**
 * An expense keyed in by hand: what, when, how much, and where the money
 * came from. Paid from a partner's own pocket, it also lands on that
 * partner's account as a contribution.
 */
export function ExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        {/* Keyed on open so each opening starts clean */}
        {open && <ExpenseForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const t = useT()
  const localized = useLocalized()
  const { recordExpense, attachReceipt, isPending } = useFinanceActions()
  const categories = useQuery(categoriesQueryOptions())
  const partners = useQuery(partnersQueryOptions())
  const fileInput = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(formatDay(new Date()))
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [paidFrom, setPaidFrom] = useState(String(PAID_FROM.drawer))
  const [partnerId, setPartnerId] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  const fromPartner = Number(paidFrom) === PAID_FROM.partner
  const canSubmit =
    categoryId !== '' &&
    parseFloat(amount) > 0 &&
    (!fromPartner || partnerId !== '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await recordExpense({
        date,
        categoryId: Number(categoryId),
        amount: parseFloat(amount),
        paidFrom: Number(paidFrom),
        partnerId: fromPartner ? Number(partnerId) : null,
        vendor: vendor.trim() || null,
        note: note.trim() || null,
      })
      // The bill's photo rides along once the line exists
      if (receipt && toNumber(created.id) > 0) {
        await attachReceipt(toNumber(created.id), receipt)
      }
      onDone()
    } catch {
      // toasted by useFinanceActions
    }
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <DialogHeader>
        <DialogTitle>{t('addExpense')}</DialogTitle>
        <DialogDescription>{t('addExpenseDescription')}</DialogDescription>
      </DialogHeader>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='expense-date'>{t('date')}</Label>
          <DatePicker
            id='expense-date'
            value={date}
            onChange={setDate}
            disabled={(d) => d > new Date()}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='expense-amount'>{t('amount')}</Label>
          <Input
            id='expense-amount'
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
          <Label htmlFor='expense-vendor'>{t('vendor')}</Label>
          <Input
            id='expense-vendor'
            value={vendor}
            placeholder={t('vendorHint')}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='expense-note'>{t('note')}</Label>
          <Input
            id='expense-note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5 sm:col-span-2'>
          <Label>{t('receiptPhoto')}</Label>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip className='me-2 h-4 w-4' />
              {receipt ? t('replaceReceipt') : t('attachReceipt')}
            </Button>
            {receipt && (
              <span className='text-muted-foreground flex min-w-0 items-center gap-1 text-xs'>
                <span className='truncate' dir='ltr'>
                  {receipt.name}
                </span>
                <button
                  type='button'
                  className='hover:text-foreground'
                  aria-label={t('removeReceipt')}
                  onClick={() => setReceipt(null)}
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </span>
            )}
          </div>
          <input
            ref={fileInput}
            type='file'
            accept={RECEIPT_ACCEPT}
            className='hidden'
            onChange={(e) => {
              const file = pickedReceipt(e, t('receiptTooLarge'))
              if (file) setReceipt(file)
            }}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={!canSubmit || isPending}>
          {isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
