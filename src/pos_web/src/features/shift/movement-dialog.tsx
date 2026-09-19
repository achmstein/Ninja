import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTillCategoriesOptions,
  getTillPartnersOptions,
  getTillSuppliersOptions,
} from '@/api/finance/@tanstack/react-query.gen'
import { getTillEmployeesOptions } from '@/api/payroll/@tanstack/react-query.gen'
import { addCashMovementMutation } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericKeypad } from '@/components/numeric-keypad'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures, type FeatureKey } from '@/lib/brand'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

// CashMovementType enum values (Sales.Domain: PayIn=0, PayOut=1)
const MOVEMENT_TYPE = { in: 0, out: 1 } as const

export type MovementDirection = keyof typeof MOVEMENT_TYPE

// CashMovementKind (Sales.Domain): what a movement was for, and whom it
// names. Wage and Advance go to Payroll; Supplier, Expense and Partner to
// Finance; Other is just a reason.
type Picks = 'employee' | 'supplier' | 'partner' | 'category' | null
type Kind = {
  value: number
  key: TranslationKey
  picks: Picks
  /** The module that keeps the ledger; the kind is off with it. */
  feature?: FeatureKey
}

const OUT_KINDS: Kind[] = [
  { value: 1, key: 'payOutSupplier', picks: 'supplier', feature: 'finance' },
  { value: 2, key: 'payOutWage', picks: 'employee', feature: 'payroll' },
  { value: 3, key: 'payOutAdvance', picks: 'employee', feature: 'payroll' },
  { value: 4, key: 'payOutExpense', picks: 'category', feature: 'finance' },
  { value: 5, key: 'payOutPartner', picks: 'partner', feature: 'finance' },
  { value: 0, key: 'payOutOther', picks: null },
]

const IN_KINDS: Kind[] = [
  { value: 5, key: 'payOutPartner', picks: 'partner', feature: 'finance' },
  { value: 0, key: 'payOutOther', picks: null },
]

// `balance` is what the café owes the person or supplier right now — the
// evening's wage, the tab a delivery is settling. A hint beside the name,
// never the amount itself: the cashier still keys what actually changes
// hands. Absent where it is nobody's business at the counter (a monthly
// employee's salary) or meaningless (a partner, a category).
type Picked = { id: number; name: string; balance?: number }

type MovementDialogProps = {
  shiftId: number
  direction: MovementDirection
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Records cash put into or taken out of the drawer mid-shift. Amount comes
 * off the keypad; the reason is required — an unexplained drawer movement
 * is exactly what the Z report exists to catch. A movement says what it
 * was for and, where that names someone (an employee, a supplier, a
 * partner) or something (an expense category), which — and the reason
 * writes itself from that.
 */
export function MovementDialog({ shiftId, direction, open, onOpenChange }: MovementDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const features = useFeatures()
  const queryClient = useQueryClient()
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<number>(0)
  const [picked, setPicked] = useState<Picked | null>(null)

  const isOut = direction === 'out'
  const kinds = (isOut ? OUT_KINDS : IN_KINDS).filter(
    (k) => !k.feature || features[k.feature]
  )
  const picks = kinds.find((k) => k.value === kind)?.picks ?? null

  // The lists behind the pickers, loaded only when their kind is picked
  const version = { query: { 'api-version': API_VERSION } }
  const employees = useQuery({
    ...getTillEmployeesOptions(version),
    enabled: open && picks === 'employee',
  })
  const suppliers = useQuery({
    ...getTillSuppliersOptions(version),
    enabled: open && picks === 'supplier',
  })
  const partners = useQuery({
    ...getTillPartnersOptions(version),
    enabled: open && picks === 'partner',
  })
  const categories = useQuery({
    ...getTillCategoriesOptions(version),
    enabled: open && picks === 'category',
  })

  useEffect(() => {
    if (!open) {
      setAmountStr('')
      setReason('')
      setKind(0)
      setPicked(null)
    }
  }, [open])

  const addMovement = useMutation({
    ...addCashMovementMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getShift' }] })
      toast.success(t('movementRecorded'))
      onOpenChange(false)
    },
  })

  const pickKind = (value: number) => {
    setKind(value)
    setPicked(null)
    // A typed reason for the old kind is stale; a named kind writes its own
    setReason('')
  }

  const pick = (item: Picked) => {
    setPicked(item)
    const label = t(kinds.find((k) => k.value === kind)!.key)
    setReason(picks === 'category' ? item.name : `${label} ${item.name}`)
  }

  const options: {
    list: Picked[] | undefined
    empty: TranslationKey
    title: TranslationKey
  } | null =
    picks === 'employee'
      ? {
          list: employees.data?.map((e) => ({
            id: Number(e.id),
            name: e.name,
            balance: e.balance == null ? undefined : toNumber(e.balance),
          })),
          empty: 'none',
          title: 'payOutWho',
        }
      : picks === 'supplier'
        ? {
            list: suppliers.data?.map((s) => ({
              id: Number(s.id),
              name: s.name,
              balance: toNumber(s.balance),
            })),
            empty: 'none',
            title: 'payOutWhichSupplier',
          }
        : picks === 'partner'
          ? {
              list: partners.data?.map((p) => ({
                id: Number(p.id),
                name: p.name,
              })),
              empty: 'none',
              title: 'payOutWhichPartner',
            }
          : picks === 'category'
            ? {
                list: categories.data?.map((c) => ({
                  id: Number(c.id),
                  name: localized(c.name),
                })),
                empty: 'none',
                title: 'payOutWhatFor',
              }
            : null

  const amount = Number(amountStr)
  const canSubmit =
    Number.isFinite(amount) &&
    amount > 0 &&
    reason.trim().length > 0 &&
    (picks === null || picked !== null) &&
    !addMovement.isPending

  const submit = () =>
    addMovement.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: shiftId },
      query: { 'api-version': API_VERSION },
      body: {
        type: MOVEMENT_TYPE[direction],
        amount,
        reason: reason.trim(),
        kind,
        employeeId: picks === 'employee' ? picked?.id : null,
        employeeName: picks === 'employee' ? picked?.name : null,
        supplierId: picks === 'supplier' ? picked?.id : null,
        supplierName: picks === 'supplier' ? picked?.name : null,
        partnerId: picks === 'partner' ? picked?.id : null,
        partnerName: picks === 'partner' ? picked?.name : null,
        categoryId: picks === 'category' ? picked?.id : null,
      },
    })

  const title = t(direction === 'in' ? 'payIn' : 'payOut')

  // Two columns, like the settle dialog: what the money is for on the
  // start side (kind, whom, the reason it writes), how much on the end
  // side (keypad and the confirm under it). Read in that order, nothing
  // scrolls off a landscape tablet; a phone stacks them.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-0 overflow-y-auto p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b px-5 py-3 pe-14'>
          <DialogTitle className='text-lg'>{title}</DialogTitle>
        </DialogHeader>

        <div className='grid gap-4 p-4 sm:grid-cols-2'>
          <div className='flex flex-col gap-4'>
            <div className='grid gap-1.5'>
              <Label>{t('payOutFor')}</Label>
              <div className={cn('grid gap-2', isOut ? 'grid-cols-3' : 'grid-cols-2')}>
                {kinds.map((k) => (
                  <Button
                    key={k.value}
                    type='button'
                    variant={kind === k.value ? 'default' : 'outline'}
                    className='h-11 px-1 text-sm'
                    onClick={() => pickKind(k.value)}
                  >
                    <span className='truncate'>{t(k.key)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {options && (
              <div className='grid gap-1.5'>
                <Label>{t(options.title)}</Label>
                {options.list && options.list.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>{t(options.empty)}</p>
                ) : (
                  <div className='grid max-h-52 gap-1.5 overflow-y-auto'>
                    {(options.list ?? []).map((item) => {
                      const isPicked = picked?.id === item.id
                      const balance = item.balance ?? 0
                      return (
                        <Button
                          key={item.id}
                          type='button'
                          variant={isPicked ? 'default' : 'outline'}
                          className={cn('h-11 justify-between gap-3', isPicked && 'font-semibold')}
                          onClick={() => pick(item)}
                        >
                          <span className='truncate'>{item.name}</span>
                          {balance !== 0 && (
                            <span
                              className={cn(
                                'shrink-0 text-xs font-normal tabular-nums',
                                isPicked
                                  ? 'text-primary-foreground/80'
                                  : balance < 0
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {balance < 0
                                ? t('owesAmount', { amount: money(-balance) })
                                : money(balance)}
                            </span>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className='grid gap-1.5'>
              <Label htmlFor='movement-reason'>{t('reason')}</Label>
              <Input
                id='movement-reason'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className='h-11 text-base'
                autoComplete='off'
              />
            </div>
          </div>

          <div className='flex flex-col gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='movement-amount'>{t('amount')}</Label>
              <Input
                id='movement-amount'
                readOnly
                inputMode='none'
                value={amountStr}
                placeholder='0'
                dir='ltr'
                className='h-14 text-end text-2xl font-bold tabular-nums'
              />
            </div>

            <NumericKeypad value={amountStr} onChange={setAmountStr} />

            <div className='mt-auto flex justify-end gap-2'>
              <Button
                variant='outline'
                size='lg'
                className='h-12'
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
              <Button size='lg' className='h-12' disabled={!canSubmit} onClick={submit}>
                {title}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
