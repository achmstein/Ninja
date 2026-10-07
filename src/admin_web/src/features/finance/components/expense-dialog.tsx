import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { formatDay } from '@/lib/business-day'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
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
import { Spinner } from '@/components/ui/spinner'
import { AiButton } from '@/components/ai-button'
import { DatePicker } from '@/components/date-picker'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid } from '@/components/field'
import { NinjaMark } from '@/components/ninja-mark'
import { FormFillButton } from '@/features/assist/form-fill-button'
import { type FillField } from '@/features/assist/use-form-fill'
import { PAID_FROM, paidFromLabel } from '../format'
import { categoriesQueryOptions, partnersQueryOptions } from '../queries'
import { pickedReceipt, RECEIPT_ACCEPT } from '../receipts'
import { useBillScan } from '../use-bill-scan'
import { useFinanceActions } from '../use-finance-actions'

/**
 * An expense keyed in by hand: what, when, how much, and where the money
 * came from. Paid from a partner's own pocket, it also lands on that
 * partner's account as a contribution. With a bill photo attached, the
 * sparkle asks the assistant to read it into the fields still empty.
 */
export function ExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  // The form owns its fields; its "Fill in with AI" is drawn into the header
  const [fillSlot, setFillSlot] = useState<HTMLElement | null>(null)
  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('addExpense')}
      headerAction={<div ref={setFillSlot} className='contents' />}
    >
      {/* Keyed on open so each opening starts clean */}
      {open && (
        <ExpenseForm onDone={() => onOpenChange(false)} fillSlot={fillSlot} />
      )}
    </EntitySheet>
  )
}

/** The fields the assistant may fill in from the bill */
type BillField = 'date' | 'amount' | 'category' | 'vendor' | 'note'

function ExpenseForm({
  onDone,
  fillSlot,
}: {
  onDone: () => void
  /** Where the sheet's header takes the form's "Fill in with AI" */
  fillSlot: HTMLElement | null
}) {
  const t = useT()
  const localized = useLocalized()
  const { recordExpense, attachReceipt, isPending } = useFinanceActions()
  const categories = useQuery(categoriesQueryOptions())
  const partners = useQuery(partnersQueryOptions())
  const fileInput = useRef<HTMLInputElement>(null)
  const billScan = useBillScan()

  const [date, setDate] = useState(formatDay(new Date()))
  // The date starts as today; only a date the user picked counts as typed
  const [dateTouched, setDateTouched] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [paidFrom, setPaidFrom] = useState(String(PAID_FROM.drawer))
  const [partnerId, setPartnerId] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  /** What the assistant filled in and the user has not touched since: shown tinted */
  const [suggested, setSuggested] = useState<Set<BillField>>(new Set())
  // Whether those came from the bill (its own hint) or "Fill in with AI"
  const [fromBill, setFromBill] = useState(false)

  const fromPartner = Number(paidFrom) === PAID_FROM.partner
  const canSubmit =
    categoryId !== '' &&
    parseFloat(amount) > 0 &&
    (!fromPartner || partnerId !== '')

  const edited = (field: BillField) =>
    setSuggested((prev) => {
      if (!prev.has(field)) return prev
      const next = new Set(prev)
      next.delete(field)
      return next
    })

  const readBill = async () => {
    if (!receipt) return
    const proposal = await billScan.scanFile(receipt)
    if (!proposal) return

    // Only what is still empty: nothing the user typed is overwritten
    const filled = new Set<BillField>()
    if (proposal.date && !dateTouched) {
      setDate(proposal.date)
      filled.add('date')
    }
    if (proposal.amount != null && amount.trim() === '') {
      setAmount(String(toNumber(proposal.amount)))
      filled.add('amount')
    }
    if (proposal.categoryId != null && categoryId === '') {
      setCategoryId(String(toNumber(proposal.categoryId)))
      filled.add('category')
    }
    if (proposal.vendor && vendor.trim() === '') {
      setVendor(proposal.vendor)
      filled.add('vendor')
    }
    if (proposal.note && note.trim() === '') {
      setNote(proposal.note)
      filled.add('note')
    }
    setSuggested(filled)
    setFromBill(filled.size > 0)

    if (filled.size === 0 && proposal.warnings.length === 0) {
      toast.info(t('billNothingToFill'))
    }
    for (const warning of proposal.warnings) toast.warning(warning)
    if (proposal.notes) toast.warning(proposal.notes)
  }

  // The category told from the vendor and the note; the amount, when typed,
  // is only a hint, and the date and the amount are never filled
  const fillFields: FillField[] = [
    {
      key: 'category',
      label: 'Expense category',
      type: 'choice',
      value: categoryId,
      options: (categories.data ?? []).map((c) => ({
        value: String(c.id),
        label: localized(c.name),
      })),
    },
    { key: 'vendor', label: 'Paid to', type: 'text', value: vendor },
    { key: 'note', label: 'Note', type: 'long', value: note },
    ...(amount.trim()
      ? [
          {
            key: 'amount',
            label: 'Amount',
            type: 'number' as const,
            value: amount,
          },
        ]
      : []),
  ]

  const applyFill = (filled: Record<string, string>) => {
    const wrote = new Set<BillField>()
    const known = (categories.data ?? []).some(
      (c) => String(c.id) === filled.category
    )
    if (filled.category && known && categoryId === '') {
      setCategoryId(filled.category)
      wrote.add('category')
    }
    if (filled.vendor && vendor.trim() === '') {
      setVendor(filled.vendor)
      wrote.add('vendor')
    }
    if (filled.note && note.trim() === '') {
      setNote(filled.note)
      wrote.add('note')
    }
    setSuggested((prev) => new Set([...prev, ...wrote]))
  }

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

  const tint = (field: BillField) => suggested.has(field) && 'bg-primary/5'
  const receiptIsPhoto = !!receipt && receipt.type.startsWith('image/')

  return (
    <form id='expense-form' onSubmit={submit} className='space-y-4'>
      {fillSlot &&
        createPortal(
          <FormFillButton
            form='an expense of a caf� or restaurant'
            fields={fillFields}
            onFilled={applyFill}
          />,
          fillSlot
        )}
      <FieldGrid>
        <Field label={t('date')} htmlFor='expense-date'>
          <DatePicker
            id='expense-date'
            value={date}
            onChange={(next) => {
              setDate(next)
              setDateTouched(true)
              edited('date')
            }}
            disabled={(d) => d > new Date()}
            className={cn(tint('date'))}
          />
        </Field>
        <Field label={t('amount')} htmlFor='expense-amount'>
          <Input
            id='expense-amount'
            type='number'
            min='0'
            step='any'
            inputMode='decimal'
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              edited('amount')
            }}
            className={cn(tint('amount'))}
            autoFocus
            required
          />
        </Field>
        <Field label={t('expenseCategory')}>
          <Select
            value={categoryId}
            onValueChange={(next) => {
              setCategoryId(next)
              edited('category')
            }}
          >
            <SelectTrigger className={cn('h-9 w-full', tint('category'))}>
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
        <Field label={t('vendor')} htmlFor='expense-vendor'>
          <Input
            id='expense-vendor'
            value={vendor}
            placeholder={t('vendorHint')}
            onChange={(e) => {
              setVendor(e.target.value)
              edited('vendor')
            }}
            className={cn(tint('vendor'))}
          />
        </Field>
        <Field label={t('note')} htmlFor='expense-note'>
          <Input
            id='expense-note'
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              edited('note')
            }}
            className={cn(tint('note'))}
          />
        </Field>
        <Field label={t('receiptPhoto')} className='sm:col-span-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip />
              {receipt ? t('replaceReceipt') : t('attachReceipt')}
            </Button>
            {receipt && billScan.available && (
              <AiButton
                pending={billScan.isScanning}
                disabled={!receiptIsPhoto}
                why={t('scanImageOnly')}
                onClick={readBill}
              >
                {billScan.isScanning ? t('readingBill') : t('readBill')}
              </AiButton>
            )}
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
          {fromBill && suggested.size > 0 && (
            <p className='text-primary flex items-center gap-1 text-xs'>
              <NinjaMark className='size-3' aria-hidden />
              {t('billFilledIn')}
            </p>
          )}
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
        </Field>
      </FieldGrid>

      <SheetActions>
        <Button type='button' variant='outline' onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button
          type='submit'
          form='expense-form'
          disabled={!canSubmit || isPending}
        >
          {isPending && <Spinner />}
          {t('save')}
        </Button>
      </SheetActions>
    </form>
  )
}
