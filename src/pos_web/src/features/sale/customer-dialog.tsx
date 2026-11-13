import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Info, User, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Highlight, matchRanges, phoneRanges } from '@/lib/highlight'
import { useT, type TranslationKey } from '@/lib/i18n'
import { showPhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import { NewCustomerDialog } from '@/features/customer/new-customer-dialog'
import {
  customerName,
  type IdentityCustomer,
} from '@/features/customer/counter-customers'
import type { SaleCustomer } from './cart'
import { useDebounced } from '@/lib/use-debounced'

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
  const {
    data: users = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['identityUserSearch', search],
    queryFn: async () => {
      const response = await apiClient.get<IdentityUser[]>(
        '/api/identity/users',
        { params: { search, excludeRole: 'Admin,Owner,Cashier', max: 20 } },
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* A sheet down the screen's end side, the whole height: the field
          stays at its top and the results fill it down to the keyboard,
          which on a landscape tablet leaves a dialog no room between itself
          and the top */}
      <SheetContent side='end' showCloseButton={false}>
        {/* A header row like every screen's: the title, and the way out */}
        <div className='flex h-16 shrink-0 items-center gap-2 border-b ps-4 pe-2'>
          <SheetTitle className='min-w-0 flex-1 truncate text-xl font-semibold'>
            {t(titleKey)}
          </SheetTitle>
          <SheetClose asChild>
            <Button
              variant='ghost'
              size='icon'
              className='size-12'
              aria-label={t('cancel')}
            >
              <X className='size-6' />
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className='sr-only'>
          {t('searchCustomersPlaceholder')}
        </SheetDescription>

        <div className='flex shrink-0 flex-col gap-4 p-4 pb-2'>
          {quickPicks.length > 0 && (
            <div className='flex flex-col gap-2'>
              <p className='text-muted-foreground text-sm'>{t('inTheRoom')}</p>
              <div className='flex flex-wrap gap-2'>
                {quickPicks.map((person) => (
                  <Button
                    key={person.id}
                    variant='outline'
                    className='h-10 max-w-full gap-2 px-3 text-base'
                    onClick={() => {
                      onSelect({ id: person.id, name: person.name })
                      onOpenChange(false)
                    }}
                  >
                    <User className='text-muted-foreground size-4 shrink-0' />
                    <span className='truncate'>
                      {person.name || t('guest')}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className='flex gap-2'>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('searchCustomersPlaceholder')}
              className='h-12 min-w-0 flex-1 text-base'
              autoComplete='off'
              autoFocus
            />
            <Button
              variant='outline'
              className='h-12 shrink-0 gap-2'
              onClick={() => setAdding(true)}
            >
              <UserPlus className='size-5' />
              {t('newCustomer')}
            </Button>
          </div>

          {!accountsOnly && typedName.length > 0 && (
            <Button
              variant='outline'
              className='h-auto min-h-14 w-full justify-start gap-3 py-2 text-base'
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
        </div>

        {/* The results get every row between the field and the bottom */}
        <div className='min-h-0 flex-1 overflow-y-auto px-2 pb-4'>
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
                        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
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
                            {/* A number reads left to right whatever the till's language:
                                without this its groups swap places in Arabic */}
                            <bdi dir='ltr'>
                              <Highlight
                                text={showPhone(user.phoneNumber)}
                                ranges={phoneRanges(showPhone(user.phoneNumber), term)}
                              />
                            </bdi>
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
      </SheetContent>
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
    </Sheet>
  )
}
