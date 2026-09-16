import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Handshake, Plus } from 'lucide-react'
import { type PartnerView } from '@/api/finance'
import { useBranchStore } from '@/stores/branch-store'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { PARTNER_ENTRY, partnerEntryLabel, sourceLabel } from './format'
import { partnerLedgerQueryOptions, partnersQueryOptions } from './queries'
import { useFinanceActions } from './use-finance-actions'

const route = getRouteApi('/_authenticated/finance/partners')

/**
 * The owners of this branch and their money in it: what each put in,
 * what each took, and the balance. Drawings from the till land here on
 * their own; the sheet takes the rest by hand. Never part of the P&L.
 */
export function Partners() {
  const t = useT()
  const navigate = route.useNavigate()
  const search = route.useSearch()

  const activeBranchId = useBranchStore((s) => s.branchId)
  const partners = useQuery(partnersQueryOptions(true))
  const [adding, setAdding] = useState(false)
  const percent = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  })

  // This branch's share, as the list shows it
  const shareHere = (p: PartnerView) =>
    toNumber(
      p.shares.find((s) => toNumber(s.branchId) === activeBranchId)?.percent ??
        0
    )

  const open = (partner?: number) =>
    navigate({ search: (prev) => ({ ...prev, partner: partner ?? undefined }) })

  const rows = partners.data ?? []
  const selected = rows.find((p) => toNumber(p.id) === search.partner) ?? null

  return (
    <>
      <Main className='flex flex-col gap-6'>
        <PageHeader
          title={t('navFinancePartners')}
          actions={
            <Button onClick={() => setAdding(true)}>
              <Plus className='me-2 h-4 w-4' />
              {t('addPartner')}
            </Button>
          }
        />

        {partners.isError ? (
          <ErrorState error={partners.error} onRetry={partners.refetch} />
        ) : partners.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={t('noPartners')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addPartner')}
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
                  <TableHead className='text-end'>{t('profitShare')}</TableHead>
                  <TableHead className='text-end'>
                    {t('partnerBalance')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const balance = toNumber(p.balance)
                  return (
                    <TableRow
                      key={String(p.id)}
                      className='cursor-pointer'
                      onClick={() => open(toNumber(p.id))}
                    >
                      <TableCell
                        className={cn(
                          'font-medium',
                          !p.isActive && 'text-muted-foreground line-through'
                        )}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell className='text-muted-foreground' dir='ltr'>
                        {p.phone || '—'}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {shareHere(p) > 0
                          ? percent.format(shareHere(p) / 100)
                          : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-end tabular-nums',
                          balance < 0 && 'text-destructive'
                        )}
                      >
                        {balance === 0
                          ? '—'
                          : balance < 0
                            ? `${t('partnerDrewNet')} ${formatEgp(-balance)}`
                            : formatEgp(balance)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Main>

      <PartnerSheet
        partner={selected}
        isNew={adding}
        onClose={() => {
          setAdding(false)
          open()
        }}
      />
    </>
  )
}

function PartnerSheet({
  partner,
  isNew,
  onClose,
}: {
  partner: PartnerView | null
  isNew: boolean
  onClose: () => void
}) {
  const t = useT()
  const open = isNew || partner !== null

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {isNew ? t('addPartner') : (partner?.name ?? '')}
          </SheetTitle>
        </SheetHeader>

        {isNew ? (
          <section className='space-y-3 border-b p-4'>
            <PartnerForm key='new' partner={null} onSaved={onClose} />
          </section>
        ) : partner ? (
          <>
            <section className='space-y-3 border-b p-4'>
              <h3 className='text-sm font-medium'>{t('details')}</h3>
              <PartnerForm
                key={String(partner.id)}
                partner={partner}
                onSaved={() => {}}
              />
            </section>
            <section className='space-y-3 border-b p-4'>
              <div>
                <h3 className='text-sm font-medium'>{t('account')}</h3>
              </div>
              <PartnerLedger partner={partner} />
            </section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function PartnerForm({
  partner,
  onSaved,
}: {
  partner: PartnerView | null
  onSaved: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const { savePartner, isPending } = useFinanceActions()
  const { branches } = useAllowedBranches()
  const activeBranchId = useBranchStore((s) => s.branchId)

  const [name, setName] = useState(partner?.name ?? '')
  const [phone, setPhone] = useState(partner?.phone ?? '')
  // Branch → share of its profit, in percent (as typed); a branch not in
  // the map is not theirs
  const [shares, setShares] = useState<Map<number, string>>(() =>
    partner
      ? new Map(
          partner.shares.map((s) => [
            toNumber(s.branchId),
            String(toNumber(s.percent)),
          ])
        )
      : activeBranchId !== null
        ? new Map([[activeBranchId, '100']])
        : new Map()
  )
  const [isActive, setIsActive] = useState(partner?.isActive ?? true)

  const toggleBranch = (id: number, checked: boolean) =>
    setShares((prev) => {
      const next = new Map(prev)
      if (checked) next.set(id, next.get(id) ?? '100')
      else next.delete(id)
      return next
    })
  const setShare = (id: number, value: string) =>
    setShares((prev) => new Map(prev).set(id, value))

  const shareList = [...shares].map(([branchId, percent]) => ({
    branchId,
    percent: parseFloat(percent) || 0,
  }))
  const sharesValid = shareList.every((s) => s.percent >= 0 && s.percent <= 100)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await savePartner({
        id: partner ? toNumber(partner.id) : null,
        name: name.trim(),
        phone: phone.trim() || null,
        userId: partner?.userId ?? null,
        shares: shareList,
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
          <Label htmlFor='partner-name'>{t('name')}</Label>
          <Input
            id='partner-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!partner}
            required
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='partner-phone'>{t('phone')}</Label>
          <Input
            id='partner-phone'
            value={phone}
            inputMode='tel'
            dir='ltr'
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5 sm:col-span-2'>
          <Label>{t('partnerBranches')}</Label>
          <div className='flex flex-col gap-2'>
            {branches.map((branch) => {
              const id = toNumber(branch.id)
              const inputId = `partner-branch-${id}`
              const held = shares.has(id)
              return (
                <div key={id} className='flex h-9 items-center gap-3'>
                  <label
                    htmlFor={inputId}
                    className='flex min-w-32 items-center gap-2 text-sm'
                  >
                    <Checkbox
                      id={inputId}
                      checked={held}
                      onCheckedChange={(checked) =>
                        toggleBranch(id, checked === true)
                      }
                    />
                    {localized(branch.name)}
                  </label>
                  {held && (
                    <div className='flex items-center gap-1.5 text-sm'>
                      <Input
                        type='number'
                        min='0'
                        max='100'
                        step='any'
                        inputMode='decimal'
                        aria-label={t('profitShare')}
                        className='w-20 text-end'
                        value={shares.get(id) ?? ''}
                        onChange={(e) => setShare(id, e.target.value)}
                      />
                      <span className='text-muted-foreground'>
                        % {t('ofProfit')}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className='flex items-center justify-between gap-2'>
        {partner ? (
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            {t('active')}
          </label>
        ) : (
          <span />
        )}
        <Button
          type='submit'
          disabled={
            name.trim() === '' || shares.size === 0 || !sharesValid || isPending
          }
        >
          {isPending && <Spinner className='me-2' />}
          {partner ? t('save') : t('addPartner')}
        </Button>
      </div>
    </form>
  )
}

function PartnerLedger({ partner }: { partner: PartnerView }) {
  const t = useT()
  const partnerId = toNumber(partner.id)
  const ledger = useQuery(partnerLedgerQueryOptions(partnerId))
  const { postPartnerEntry, isPending } = useFinanceActions()

  const [adding, setAdding] = useState(false)
  const [type, setType] = useState(String(PARTNER_ENTRY.contribution))
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDay(new Date()))
  const [note, setNote] = useState('')

  const balance = toNumber(ledger.data?.balance ?? partner.balance)

  const exportCsv = () =>
    downloadCsv(
      `partner-${partner.name}`,
      [t('date'), t('type'), t('note'), t('source'), t('amount')],
      (ledger.data?.entries ?? []).map((e) => [
        e.date,
        partnerEntryLabel(e.type, t),
        e.note,
        sourceLabel(e.source, e.recordedBy, t),
        toNumber(e.signed),
      ])
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postPartnerEntry(partnerId, {
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
            {balance < 0 ? t('partnerDrewNet') : t('partnerBalance')}
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
                  {[PARTNER_ENTRY.contribution, PARTNER_ENTRY.drawing].map(
                    (v) => (
                      <SelectItem key={v} value={String(v)}>
                        {partnerEntryLabel(v, t)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='partner-amount'>{t('amount')}</Label>
              <Input
                id='partner-amount'
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
              <Label htmlFor='partner-date'>{t('date')}</Label>
              <DatePicker
                id='partner-date'
                value={date}
                onChange={setDate}
                disabled={(d) => d > new Date()}
              />
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='partner-note'>{t('note')}</Label>
            <Input
              id='partner-note'
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
            label: partnerEntryLabel(e.type, t),
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
