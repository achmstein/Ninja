import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Info, User, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Highlight, matchRanges, phoneRanges } from '@/lib/highlight'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CustomerCard, type CardCustomer } from '@/features/customer/customer-card'
import { NewCustomerDialog } from '@/features/customer/new-customer-dialog'
import { customerName, type IdentityCustomer } from '@/features/customer/counter-customers'
import type { SaleCustomer } from './cart'

// Keycloak user as the identity BFF route returns it. No generated SDK for
// this endpoint (it proxies Keycloak, not one of our OpenAPI services), so
// it goes through the shared axios client like admin_web's customer search.
type IdentityUser = {
  id: string
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  addedAtCounter?: boolean
}

function displayName(user: IdentityUser): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    ''
  )
}

const SEARCH_DEBOUNCE_MS = 300
const MIN_SEARCH_LENGTH = 2

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

type CustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (customer: SaleCustomer) => void
  /**
   * Only people with an account can be picked: no "use this name" shortcut.
   * For the room roster, where a member is a tab the bill can go on and a
   * bare name is nobody.
   */
  accountsOnly?: boolean
  /**
   * People to offer before the search: the room's roster when the sale is
   * for a room. Most of the time the person is already there, so this is
   * one tap instead of a search.
   */
  quickPicks?: { id: string; name: string }[]
  /** The dialog's title; "Choose customer" unless it is a plain lookup. */
  titleKey?: TranslationKey
  /**
   * Accounts that cannot be picked, each with where their bill is: opening
   * a new bill, whoever already has one running shows greyed out with it —
   * one person, one bill.
   */
  busy?: ReadonlyMap<string, string>
}

/**
 * Attach-a-customer search for loyalty accrual and on-account settling —
 * the one picker behind "Choose customer" on the sale pad and in the
 * new-bill dialog. Debounced Keycloak search; admins are excluded
 * server-side so staff accounts never end up as "customers" on a sale.
 */
export function CustomerDialog({
  open,
  onOpenChange,
  onSelect,
  accountsOnly = false,
  quickPicks = [],
  titleKey = 'chooseCustomer',
  busy,
}: CustomerDialogProps) {
  const t = useT()
  const [term, setTerm] = useState('')
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)
  const [adding, setAdding] = useState(false)
  const debouncedTerm = useDebounced(term.trim(), SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (!open) setTerm('')
  }, [open])

  const search = debouncedTerm.length >= MIN_SEARCH_LENGTH ? debouncedTerm : ''
  const { data: users = [], isFetching, isError } = useQuery({
    queryKey: ['identityUserSearch', search],
    queryFn: async () => {
      const response = await apiClient.get<IdentityUser[]>(
        '/api/identity/users',
        { params: { search, excludeRole: 'Admin,Owner,Cashier', max: 20 } }
      )
      return response.data
    },
    placeholderData: keepPreviousData,
    enabled: open && search.length > 0,
  })

  const pick = (user: IdentityUser) => {
    onSelect({ id: user.id, name: displayName(user), phone: user.phoneNumber })
    onOpenChange(false)
  }

  // Most people at a table have no account, and the waiters know them by
  // name anyway. Taking the typed text as the name costs one tap and is the
  // common case — so it sits above the results, not buried under them.
  const typedName = term.trim()
  const useTypedName = () => {
    onSelect({ id: null, name: typedName })
    onOpenChange(false)
  }

  // Someone the till does not know yet, by name and phone: an account made
  // here, found again by their number next time
  const pickNew = (customer: IdentityCustomer) => {
    const onBill = busy?.get(customer.id)
    if (onBill) {
      toast.error(t('alreadyOnBill', { where: onBill }))
      return
    }
    setAdding(false)
    onSelect({
      id: customer.id,
      name: customerName(customer),
      phone: customer.phoneNumber,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On a phone the picker takes the whole height: the results get the
          room between the search box and the buttons, and scroll there */}
      <DialogContent className='flex max-h-[85svh] flex-col gap-4 max-sm:h-[calc(100svh-1.5rem)] max-sm:overflow-hidden sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t(titleKey)}</DialogTitle>
        </DialogHeader>

        {quickPicks.length > 0 && (
          <div className='flex flex-col gap-2'>
            <p className='text-muted-foreground text-sm'>{t('inTheRoom')}</p>
            <div className='flex flex-wrap gap-2'>
              {quickPicks.map((person) => (
                <Button
                  key={person.id}
                  variant='outline'
                  className='h-11 max-w-full gap-2 px-3 text-base'
                  onClick={() => {
                    onSelect({ id: person.id, name: person.name })
                    onOpenChange(false)
                  }}
                >
                  <User className='text-muted-foreground size-4 shrink-0' />
                  <span className='truncate'>{person.name || t('guest')}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('searchCustomersPlaceholder')}
          className='h-12 text-base'
          autoComplete='off'
          autoFocus
        />

        {!accountsOnly && typedName.length > 0 && (
          <Button
            variant='outline'
            className='h-14 w-full justify-start gap-3 text-base'
            onClick={useTypedName}
          >
            <UserPlus className='text-muted-foreground size-5 shrink-0' />
            <span className='min-w-0 text-start'>
              <span className='block truncate font-medium'>
                {t('useNameAction', { name: typedName })}
              </span>
              <span className='text-muted-foreground block text-sm font-normal'>
                {t('noAccountNeeded')}
              </span>
            </span>
          </Button>
        )}

        <div className='-mx-2 min-h-0 flex-1 overflow-y-auto'>
          {search.length === 0 ? null : isFetching && users.length === 0 ? (
            <div className='flex flex-col'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className='flex min-h-14 items-center gap-3 px-3 py-2'
                >
                  {/* avatar, name, phone — a customer row's shape */}
                  <Skeleton className='size-5 shrink-0 rounded-full' />
                  <div className='min-w-0 flex-1 space-y-1.5'>
                    <Skeleton className='h-4 w-1/2' />
                    <Skeleton className='h-3 w-1/3' />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('somethingWentWrong')}
            </p>
          ) : users.length === 0 ? (
            <div className='flex flex-col items-center gap-3 py-6'>
              <p className='text-muted-foreground text-center text-sm'>
                {t('noCustomersFound')}
              </p>
              <Button
                variant='outline'
                className='h-11 gap-2'
                onClick={() => setAdding(true)}
              >
                <UserPlus className='size-4' />
                {t('newCustomer')}
              </Button>
            </div>
          ) : (
            <div className='flex flex-col'>
              {users.map((user) => {
                const onBill = busy?.get(user.id)
                return (
                <div key={user.id} className='flex items-center gap-1'>
                <button
                  type='button'
                  disabled={!!onBill}
                  onClick={() => pick(user)}
                  className={cn(
                    'hover:bg-accent flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-start',
                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent'
                  )}
                >
                  <User className='text-muted-foreground size-5 shrink-0' />
                  <span className='min-w-0'>
                    {/* The letters that matched, marked, so the eye lands on
                        the right Ahmed without reading every row */}
                    <span className='block truncate text-base font-medium'>
                      <Highlight
                        text={displayName(user)}
                        ranges={matchRanges(displayName(user), term)}
                      />
                    </span>
                    {onBill ? (
                      <span className='text-muted-foreground block truncate text-sm'>
                        {t('alreadyOnBill', { where: onBill })}
                      </span>
                    ) : user.phoneNumber ? (
                      <span className='text-muted-foreground block truncate text-sm'>
                        <Highlight
                          text={user.phoneNumber}
                          ranges={phoneRanges(user.phoneNumber, term)}
                        />
                      </span>
                    ) : user.email ? (
                      <span className='text-muted-foreground block truncate text-sm'>
                        <Highlight
                          text={user.email}
                          ranges={matchRanges(user.email, term)}
                        />
                      </span>
                    ) : null}
                  </span>
                </button>
                {/* A look before the pick: points and tab, without attaching */}
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-11 shrink-0'
                  aria-label={t('customerDetails')}
                  onClick={() =>
                    setCardFor({
                      id: user.id,
                      name: displayName(user),
                      phone: user.phoneNumber,
                      addedAtCounter: !!user.addedAtCounter,
                    })
                  }
                >
                  <Info className='text-muted-foreground size-5' />
                </Button>
                </div>
                )
              })}
            </div>
          )}
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant='secondary'
            size='lg'
            className='h-12 gap-2'
            onClick={() => setAdding(true)}
          >
            <UserPlus className='size-4' />
            {t('newCustomer')}
          </Button>
        </div>
      </DialogContent>
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />
      <NewCustomerDialog
        open={adding}
        onOpenChange={setAdding}
        initialText={typedName}
        onPick={pickNew}
      />
    </Dialog>
  )
}
