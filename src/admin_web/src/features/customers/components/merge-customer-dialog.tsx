import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown } from 'lucide-react'
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
import { loyaltyKeys } from '@/features/loyalty/hooks/use-loyalty'
import { customersKeys } from '../hooks/use-customers'
import { customersService } from '../services/customers-service'
import { getCustomerDisplayName, type Customer } from '../types'

// Staff sign in from the same directory; none of them is a customer to merge into
const NOT_CUSTOMERS = 'Admin,Owner,Cashier,Kitchen,Rider'

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

const reach = (customer: Customer) =>
  showPhone(customer.phoneNumber) || customer.email || customer.username || ''

/**
 * One person with two accounts (two emails, or once at the counter and once
 * in the app): the owner picks the account to keep, sees what will happen in
 * plain words, and agrees once. This account's tab, points, orders, bills
 * and reservations go to the kept one and this one is switched off. It
 * cannot be undone, so the second step says so before the button does it.
 */
export function MergeCustomerDialog({
  customer,
  open,
  onOpenChange,
  onMerged,
}: {
  /** The account that goes away */
  customer: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The kept account's id, to show it next */
  onMerged: (intoId: string) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [into, setInto] = useState<Customer | null>(null)
  const search = useDebounced(term.trim(), 300)

  // Closed by any way out, it opens empty the next time
  const close = () => {
    setTerm('')
    setInto(null)
    onOpenChange(false)
  }

  const matches = useQuery({
    queryKey: [...customersKeys.all, 'merge', search],
    queryFn: () =>
      customersService.getCustomers({
        search,
        max: 8,
        excludeRole: NOT_CUSTOMERS,
        enabled: true,
      }),
    enabled: open && !into && search.length >= 2,
  })
  const results = (matches.data ?? []).filter(
    (c) => c.id !== customer.id && c.enabled
  )

  const merge = useMutation({
    mutationFn: () => customersService.mergeInto(customer.id, into!.id),
    onSuccess: () => {
      // The services move their rows off the bus, a beat after this answer
      queryClient.invalidateQueries({ queryKey: customersKeys.all })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.all })
      toast.success(
        t('mergeDone', { name: into ? getCustomerDisplayName(into) : '' })
      )
      const keptId = into!.id
      close()
      onMerged(keptId)
    },
    onError: () => toast.error(t('mergeFailed')),
  })

  const name = getCustomerDisplayName(customer)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (merge.isPending) return
        if (next) onOpenChange(true)
        else close()
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('mergeCustomerTitle')}</DialogTitle>
          <p className='text-muted-foreground text-sm'>
            {t('mergeCustomerHint')}
          </p>
        </DialogHeader>

        {!into ? (
          <div className='space-y-2'>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('mergeSearchPlaceholder')}
              autoComplete='off'
              autoFocus
            />
            <div className='min-h-32'>
              {search.length < 2 ? null : matches.isLoading ? (
                <p className='text-muted-foreground p-3 text-sm'>…</p>
              ) : results.length === 0 ? (
                <p className='text-muted-foreground p-3 text-sm'>
                  {t('noCustomersFound')}
                </p>
              ) : (
                <ul className='divide-y'>
                  {results.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type='button'
                        onClick={() => setInto(candidate)}
                        className='hover:bg-accent focus-visible:bg-accent flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-start text-sm outline-none'
                      >
                        <span className='truncate font-medium'>
                          {getCustomerDisplayName(candidate)}
                        </span>
                        <span className='text-muted-foreground shrink-0 text-xs'>
                          {reach(candidate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className='space-y-3'>
            {/* The one that goes, an arrow, the one that stays */}
            <div className='space-y-2'>
              <div className='rounded-lg border border-dashed p-3'>
                <p className='text-muted-foreground text-xs'>
                  {t('mergeGoesAway')}
                </p>
                <p className='truncate text-sm font-medium'>{name}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {reach(customer)}
                </p>
              </div>
              <ArrowDown className='text-muted-foreground mx-auto size-4' />
              <div className='rounded-lg border p-3'>
                <p className='text-muted-foreground text-xs'>
                  {t('mergeIsKept')}
                </p>
                <p className='truncate text-sm font-medium'>
                  {getCustomerDisplayName(into)}
                </p>
                <p className='text-muted-foreground truncate text-xs'>
                  {reach(into)}
                </p>
              </div>
            </div>
            <ul className='text-muted-foreground list-disc space-y-1 ps-5 text-sm'>
              <li>{t('mergeMovesEverything')}</li>
              <li>{t('mergeSwitchesOff', { name })}</li>
              <li className='text-foreground font-medium'>
                {t('mergeCannotBeUndone')}
              </li>
            </ul>
          </div>
        )}

        <DialogFooter>
          {into ? (
            <Button
              type='button'
              variant='outline'
              disabled={merge.isPending}
              onClick={() => setInto(null)}
            >
              {t('mergeChooseAnother')}
            </Button>
          ) : (
            <Button type='button' variant='outline' onClick={close}>
              {t('cancel')}
            </Button>
          )}
          <Button
            type='button'
            variant='destructive'
            disabled={!into || merge.isPending}
            onClick={() => merge.mutate()}
          >
            {merge.isPending && <Spinner />}
            {t('mergeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
