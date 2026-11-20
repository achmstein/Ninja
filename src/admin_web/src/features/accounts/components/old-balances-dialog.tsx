import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { showPhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { customersKeys } from '@/features/customers/hooks/use-customers'
import { customersService } from '@/features/customers/services/customers-service'
import {
  getCustomerDisplayName,
  type Customer,
} from '@/features/customers/types'
import { formatEgp } from '@/features/orders/status'
import { accountsService } from '../services/accounts-service'

type Line = { customer: Customer; amount: number }

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

// Staff sign in from the same directory; none of them is a customer with a tab
const NOT_CUSTOMERS = 'Admin,Owner,Cashier,Kitchen,Rider'

/**
 * The notebook a business brings with it: what each customer already owed
 * before their tabs were kept here, entered down a list instead of one
 * customer page at a time. A name, an amount, Enter, the next one; the
 * list is read over and then put on the tabs together, each as a charge
 * that says what it is. No money moves: the till and its drawer hear
 * nothing of it.
 */
export function OldBalancesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Customer | null>(null)
  const [amount, setAmount] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const searchField = useRef<HTMLInputElement>(null)
  const amountField = useRef<HTMLInputElement>(null)

  const search = useDebounce(term.trim(), 300)
  const matches = useQuery({
    queryKey: [...customersKeys.all, 'old-balances', search],
    queryFn: () =>
      customersService.getCustomers({
        search,
        max: 6,
        excludeRole: NOT_CUSTOMERS,
        enabled: true,
      }),
    enabled: open && !picked && search.length >= 2,
  })

  const pick = (customer: Customer) => {
    setPicked(customer)
    setTerm(getCustomerDisplayName(customer))
    // The amount is next: the field is there by the next frame
    requestAnimationFrame(() => amountField.current?.focus())
  }

  const value = parseFloat(amount)
  const canAdd = !!picked && Number.isFinite(value) && value > 0

  const add = () => {
    if (!picked || !canAdd) return
    // One line a customer: entered twice, the later figure is the one meant
    setLines((all) => [
      ...all.filter((l) => l.customer.id !== picked.id),
      { customer: picked, amount: value },
    ])
    setPicked(null)
    setTerm('')
    setAmount('')
    searchField.current?.focus()
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0)

  const save = async () => {
    setSaving(true)
    const failed: Line[] = []
    // One at a time: a tab that opens with its first charge is made then
    for (const line of lines) {
      try {
        await accountsService.addCharge(line.customer.id, {
          amount: line.amount,
          description: t('oldBalance'),
          customerName: getCustomerDisplayName(line.customer),
        })
      } catch {
        failed.push(line)
      }
    }
    setSaving(false)
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: customersKeys.all })
    const done = lines.length - failed.length
    if (done > 0) toast.success(t('oldBalancesSaved', { count: done }))
    setLines(failed)
    if (failed.length > 0) {
      // What did not go on stays in the list, to try again
      toast.error(t('oldBalancesFailed', { count: failed.length }))
      return
    }
    onOpenChange(false)
  }

  const close = (next: boolean) => {
    if (saving) return
    if (!next) {
      setTerm('')
      setPicked(null)
      setAmount('')
      setLines([])
    }
    onOpenChange(next)
  }

  const results = matches.data ?? []

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className='flex max-h-[90svh] flex-col gap-4 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('oldBalances')}</DialogTitle>
          <p className='text-muted-foreground text-sm'>
            {t('oldBalancesHint')}
          </p>
        </DialogHeader>

        <form
          className='flex items-start gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <div className='relative min-w-0 flex-1'>
            <Input
              ref={searchField}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value)
                setPicked(null)
              }}
              placeholder={t('searchCustomersPlaceholder')}
              autoComplete='off'
              autoFocus
            />
            {!picked && search.length >= 2 && (
              <div className='bg-popover absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border shadow-md'>
                {matches.isLoading ? (
                  <p className='text-muted-foreground p-3 text-sm'>…</p>
                ) : results.length === 0 ? (
                  <p className='text-muted-foreground p-3 text-sm'>
                    {t('noCustomersFound')}
                  </p>
                ) : (
                  results.map((customer) => (
                    <button
                      key={customer.id}
                      type='button'
                      onClick={() => pick(customer)}
                      className='hover:bg-accent focus-visible:bg-accent flex w-full items-baseline justify-between gap-3 px-3 py-2 text-start text-sm outline-none'
                    >
                      <span className='truncate font-medium'>
                        {getCustomerDisplayName(customer)}
                      </span>
                      <span className='text-muted-foreground shrink-0 text-xs'>
                        {showPhone(customer.phoneNumber) || customer.email}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Input
            ref={amountField}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type='number'
            inputMode='decimal'
            step='0.01'
            min='0.01'
            placeholder='0.00'
            aria-label={t('amountEgpLabel')}
            className='w-28 tabular-nums'
            dir='ltr'
          />
          <Button type='submit' variant='outline' disabled={!canAdd}>
            {t('add')}
          </Button>
        </form>

        <div className='min-h-24 flex-1 overflow-y-auto'>
          {lines.length === 0 ? (
            <p className='text-muted-foreground py-6 text-center text-sm'>
              {t('oldBalancesEmpty')}
            </p>
          ) : (
            <ul className='divide-y text-sm'>
              {lines.map((line) => (
                <li
                  key={line.customer.id}
                  className='flex items-center gap-3 py-2'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium'>
                      {getCustomerDisplayName(line.customer)}
                    </span>
                    {line.customer.phoneNumber && (
                      <span className='text-muted-foreground block text-xs'>
                        {showPhone(line.customer.phoneNumber)}
                      </span>
                    )}
                  </span>
                  <span className='shrink-0 tabular-nums'>
                    {formatEgp(line.amount)}
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground size-8 shrink-0'
                    aria-label={t('remove')}
                    disabled={saving}
                    onClick={() =>
                      setLines((all) =>
                        all.filter((l) => l.customer.id !== line.customer.id)
                      )
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className='items-center sm:justify-between'>
          <span className='text-sm tabular-nums'>
            {lines.length > 0 && (
              <>
                <span className='text-muted-foreground'>{t('total')} </span>
                <span className='font-semibold'>{formatEgp(total)}</span>
              </>
            )}
          </span>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              disabled={saving}
              onClick={() => close(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='button'
              disabled={lines.length === 0 || saving}
              onClick={save}
            >
              {saving && <Spinner />}
              {t('oldBalancesSave', { count: lines.length })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The customers page's way in: quiet beside Add customer, it is used for a week and then rarely. */
export function OldBalancesButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        <NotebookPen />
        {t('oldBalances')}
      </Button>
      <OldBalancesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
