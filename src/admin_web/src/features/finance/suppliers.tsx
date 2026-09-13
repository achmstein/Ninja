import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Plus, Truck } from 'lucide-react'
import { type SupplierView } from '@/api/finance'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DatePicker } from '@/components/date-picker'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ExportButton } from '@/components/export-button'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { LedgerList } from './components/ledger-list'
import { sourceLabel, SUPPLIER_ENTRY, supplierEntryLabel } from './format'
import { supplierLedgerQueryOptions, suppliersQueryOptions } from './queries'
import { useFinanceActions } from './use-finance-actions'

const route = getRouteApi('/_authenticated/finance/suppliers')

/**
 * Who the café buys from and what it owes each of them at this branch.
 * Deliveries land on an account from Inventory's receipts, payments from
 * the till; the sheet shows the account and takes a payment, credit or
 * invoice keyed in by hand.
 */
export function Suppliers() {
  const t = useT()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const showInactive = search.inactive === true

  const suppliers = useQuery(suppliersQueryOptions(showInactive))
  const [adding, setAdding] = useState(false)

  const open = (supplier?: number) =>
    navigate({
      search: (prev) => ({ ...prev, supplier: supplier ?? undefined }),
    })

  const rows = suppliers.data ?? []
  const totalOwed = rows.reduce(
    (sum, s) => sum + Math.max(0, toNumber(s.balance)),
    0
  )
  const selected = rows.find((s) => toNumber(s.id) === search.supplier) ?? null

  return (
    <>
      <Main className='flex flex-col gap-6'>
        <PageHeader
          title={t('navFinanceSuppliers')}
          description={t('suppliersSubtitle')}
          badge={
            totalOwed > 0 ? (
              <span className='text-muted-foreground text-sm tabular-nums'>
                {t('owedToSuppliers', { amount: formatEgp(totalOwed) })}
              </span>
            ) : null
          }
          actions={
            <Button onClick={() => setAdding(true)}>
              <Plus className='me-2 h-4 w-4' />
              {t('addSupplier')}
            </Button>
          }
        >
          <label className='flex items-center gap-2 text-sm'>
            <Switch
              checked={showInactive}
              onCheckedChange={(checked) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    inactive: checked || undefined,
                  }),
                })
              }
            />
            {t('showRetired')}
          </label>
        </PageHeader>

        {suppliers.isError ? (
          <ErrorState error={suppliers.error} onRetry={suppliers.refetch} />
        ) : suppliers.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={t('noSuppliers')}
            description={t('noSuppliersHint')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addSupplier')}
              </Button>
            }
          />
        ) : (
          <div className='overflow-x-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('phone')}</TableHead>
                  <TableHead className='text-end'>{t('weOwe')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const balance = toNumber(s.balance)
                  return (
                    <TableRow
                      key={String(s.id)}
                      className='cursor-pointer'
                      onClick={() => open(toNumber(s.id))}
                    >
                      <TableCell
                        className={cn(
                          'font-medium',
                          !s.isActive && 'text-muted-foreground line-through'
                        )}
                      >
                        {s.name}
                      </TableCell>
                      <TableCell className='text-muted-foreground' dir='ltr'>
                        {s.phone || '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-end tabular-nums',
                          balance > 0 && 'font-semibold',
                          balance < 0 && 'text-success'
                        )}
                      >
                        {balance === 0 ? '—' : formatEgp(balance)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Main>

      <SupplierSheet
        supplier={selected}
        isNew={adding}
        onClose={() => {
          setAdding(false)
          open()
        }}
      />
    </>
  )
}

function SupplierSheet({
  supplier,
  isNew,
  onClose,
}: {
  supplier: SupplierView | null
  isNew: boolean
  onClose: () => void
}) {
  const t = useT()
  const open = isNew || supplier !== null

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {isNew ? t('addSupplier') : (supplier?.name ?? '')}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? t('addSupplierDescription')
              : (supplier?.phone ?? t('supplier'))}
          </SheetDescription>
        </SheetHeader>

        {isNew ? (
          <section className='space-y-3 border-b p-4'>
            <SupplierForm key='new' supplier={null} onSaved={onClose} />
          </section>
        ) : supplier ? (
          <>
            <section className='space-y-3 border-b p-4'>
              <h3 className='text-sm font-semibold'>{t('details')}</h3>
              <SupplierForm
                key={String(supplier.id)}
                supplier={supplier}
                onSaved={() => {}}
              />
            </section>
            <section className='space-y-3 border-b p-4'>
              <div>
                <h3 className='text-sm font-semibold'>{t('account')}</h3>
                <p className='text-muted-foreground text-xs'>
                  {t('supplierAccountHint')}
                </p>
              </div>
              <SupplierLedger supplier={supplier} />
            </section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SupplierForm({
  supplier,
  onSaved,
}: {
  supplier: SupplierView | null
  onSaved: () => void
}) {
  const t = useT()
  const { saveSupplier, isPending } = useFinanceActions()
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveSupplier({
        id: supplier ? toNumber(supplier.id) : null,
        name: name.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        isActive,
      })
      onSaved()
    } catch {
      // toasted by useFinanceActions
    }
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='sup-name'>{t('name')}</Label>
          <Input
            id='sup-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!supplier}
            required
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='sup-phone'>{t('phone')}</Label>
          <Input
            id='sup-phone'
            value={phone}
            inputMode='tel'
            dir='ltr'
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5 sm:col-span-2'>
          <Label htmlFor='sup-notes'>{t('note')}</Label>
          <Input
            id='sup-notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div className='flex items-center justify-between gap-2'>
        {supplier ? (
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            {t('active')}
          </label>
        ) : (
          <span />
        )}
        <Button type='submit' disabled={name.trim() === '' || isPending}>
          {isPending && <Spinner className='me-2' />}
          {supplier ? t('save') : t('addSupplier')}
        </Button>
      </div>
    </form>
  )
}

function SupplierLedger({ supplier }: { supplier: SupplierView }) {
  const t = useT()
  const supplierId = toNumber(supplier.id)
  const ledger = useQuery(supplierLedgerQueryOptions(supplierId))
  const { postSupplierEntry, isPending } = useFinanceActions()

  const [adding, setAdding] = useState(false)
  const [type, setType] = useState(String(SUPPLIER_ENTRY.payment))
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDay(new Date()))
  const [note, setNote] = useState('')

  const balance = toNumber(ledger.data?.balance ?? supplier.balance)

  const exportCsv = () =>
    downloadCsv(
      `supplier-${supplier.name}`,
      [t('date'), t('type'), t('note'), t('source'), t('amount')],
      (ledger.data?.entries ?? []).map((e) => [
        e.date,
        supplierEntryLabel(e.type, t),
        e.note,
        sourceLabel(e.source, e.recordedBy, t),
        toNumber(e.signed),
      ])
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postSupplierEntry(supplierId, {
        type: Number(type),
        amount: parseFloat(amount),
        date,
        note: note.trim() || null,
      })
      setAdding(false)
      setAmount('')
      setNote('')
    } catch {
      // toasted by useFinanceActions
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <div className='text-muted-foreground text-xs'>
            {balance < 0 ? t('supplierOwesUs') : t('weOwe')}
          </div>
          <div className='text-lg font-semibold tabular-nums'>
            {formatEgp(Math.abs(balance))}
          </div>
        </div>
        {!adding && (
          <div className='flex gap-2'>
            <ExportButton
              size='sm'
              onExport={exportCsv}
              disabled={(ledger.data?.entries.length ?? 0) === 0}
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setAdding(true)}
            >
              <Plus className='me-2 h-4 w-4' />
              {t('addLedgerEntry')}
            </Button>
          </div>
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
                  {[
                    SUPPLIER_ENTRY.payment,
                    SUPPLIER_ENTRY.credit,
                    SUPPLIER_ENTRY.invoice,
                  ].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {supplierEntryLabel(v, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sup-amount'>{t('amount')}</Label>
              <Input
                id='sup-amount'
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
              <Label htmlFor='sup-date'>{t('date')}</Label>
              <DatePicker
                id='sup-date'
                value={date}
                onChange={setDate}
                disabled={(d) => d > new Date()}
              />
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sup-note'>{t('note')}</Label>
            <Input
              id='sup-note'
              value={note}
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
      ) : (
        <LedgerList
          emptyMessage={t('ledgerEmpty')}
          lines={(ledger.data?.entries ?? []).map((e) => ({
            id: e.id,
            label: supplierEntryLabel(e.type, t),
            signed: e.signed,
            date: e.date,
            note: e.note,
            source: e.source,
            recordedBy: e.recordedBy,
          }))}
        />
      )}
    </div>
  )
}
