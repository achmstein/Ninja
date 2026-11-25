import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Info, Pencil, User, UserPlus, X } from 'lucide-react'
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
import { editablePhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import {
  looksLikePhone,
  NewCustomerForm,
} from '@/features/customer/new-customer-form'
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
  /** False for an account the owner switched off: shown, greyed, not to be picked */
  enabled?: boolean
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
  // Tapping the field is the start of a search: the sheet grows to the whole
  // screen, the field on its top row and nothing but results under it, as a
  // search opens in any phone app. With nobody in the room to offer first,
  // it opens that way, keyboard up: the search is all there is to do. The
  // back arrow brings the sheet back, or closes it when there was none
  const [searching, setSearching] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const hasPicks = quickPicks.length > 0
  const debouncedTerm = useDebounced(term.trim(), SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (!open) {
      setTerm('')
      setSearching(false)
      setAdding(false)
    }
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
        // A duplicate merged into another customer is not a person to show
        { params: { search, excludeRole: 'Admin,Owner,Cashier', merged: false, max: 20 } },
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
  // common case — so it is the first row under the field, not buried under
  // the results. A number is nobody's name: that one is a customer to add
  const typedName = term.trim()
  const offerName =
    !accountsOnly && typedName.length > 0 && !looksLikePhone(typedName)
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
      <SheetContent
        side='end'
        showCloseButton={false}
        className={cn(
          'transition-[max-width]',
          searching && 'max-w-[100vw] border-s-0',
        )}
        // A room's people come first and the keyboard waits for a tap on
        // the field; with nobody to offer, the field is where it starts
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          if (!hasPicks) field.current?.focus()
        }}
      >
        <SheetDescription className='sr-only'>
          {t('searchCustomersPlaceholder')}
        </SheetDescription>
        {/* Across a whole tablet a row would run from one edge to the other:
            the search keeps to a column down the middle */}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            searching && 'mx-auto w-full max-w-2xl',
          )}
        >
          {adding ? (
            // Adding someone takes the search's place, in the same sheet:
            // back is the search again, what was typed still in it
            <>
              <div className='flex h-16 shrink-0 items-center gap-2 border-b px-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-12 shrink-0'
                  aria-label={t('goBack')}
                  onClick={() => setAdding(false)}
                >
                  <ArrowLeft className='size-6 rtl:rotate-180' />
                </Button>
                <SheetTitle className='min-w-0 flex-1 truncate text-xl font-semibold'>
                  {t('newCustomer')}
                </SheetTitle>
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto p-4'>
                <NewCustomerForm
                  initialText={typedName}
                  onPick={pickNew}
                  onCancel={() => setAdding(false)}
                />
              </div>
            </>
          ) : (
            <>
              {searching ? (
                <SheetTitle className='sr-only'>{t(titleKey)}</SheetTitle>
              ) : (
                // A header row like every screen's: the title, and the way out
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
              )}

              <div
                className={cn(
                  'flex shrink-0 flex-col gap-4 p-4 pb-2',
                  searching && 'ps-2',
                )}
              >
                {!searching && hasPicks && (
                  <div className='flex flex-col gap-2'>
                    <p className='text-muted-foreground text-sm'>
                      {t('inTheRoom')}
                    </p>
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
                  {searching && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-12 shrink-0'
                      aria-label={t('goBack')}
                      onClick={() => {
                        if (!hasPicks) return onOpenChange(false)
                        field.current?.blur()
                        setSearching(false)
                      }}
                    >
                      <ArrowLeft className='size-6 rtl:rotate-180' />
                    </Button>
                  )}
                  <Input
                    ref={field}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onFocus={() => setSearching(true)}
                    placeholder={t('searchCustomersPlaceholder')}
                    className='h-12 min-w-0 flex-1 text-base'
                    autoComplete='off'
                    // Back from adding someone, the search is where it was
                    autoFocus={searching}
                  />
                </div>
              </div>

        {/* The results get every row between the field and the bottom */}
        <div className='min-h-0 flex-1 overflow-y-auto px-2 pb-4'>
          {/* The two ways on that need no result, as rows of the list: the
              typed name as it is, and a customer made here */}
          <div className='mb-1 flex flex-col border-b pb-1'>
            {offerName && (
              <button
                type='button'
                onClick={useTypedName}
                className='hover:bg-accent flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-start'
              >
                <Pencil className='text-muted-foreground size-5 shrink-0' />
                <span className='min-w-0'>
                  <span className='block truncate text-base font-medium'>
                    {t('useNameAction', { name: typedName })}
                  </span>
                  <span className='text-muted-foreground block truncate text-sm'>
                    {t('noAccountNeeded')}
                  </span>
                </span>
              </button>
            )}
            <button
              type='button'
              onClick={() => setAdding(true)}
              className='hover:bg-accent flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-start'
            >
              <UserPlus className='text-muted-foreground size-5 shrink-0' />
              <span className='block truncate text-base font-medium'>
                {t('newCustomer')}
              </span>
            </button>
          </div>
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
            <p className='text-muted-foreground py-6 text-center text-sm'>
              {t('noCustomersFound')}
            </p>
          ) : (
            <div className='flex flex-col'>
              {users.map((user) => {
                const onBill = busy?.get(user.id)
                const off = user.enabled === false
                return (
                  <div key={user.id} className='flex items-center gap-1'>
                    <button
                      type='button'
                      disabled={!!onBill || off}
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
                        {off ? (
                          <span className='text-muted-foreground block truncate text-sm'>
                            {t('customerDisabled')}
                          </span>
                        ) : onBill ? (
                          <span className='text-muted-foreground block truncate text-sm'>
                            {t('alreadyOnBill', { where: onBill })}
                          </span>
                        ) : user.phoneNumber ? (
                          <span className='text-muted-foreground block truncate text-sm'>
                            {/* A number reads left to right whatever the till's language:
                                without this its groups swap places in Arabic */}
                            <bdi dir='ltr'>
                              <Highlight
                                text={editablePhone(user.phoneNumber)}
                                ranges={phoneRanges(editablePhone(user.phoneNumber), term)}
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
            </>
          )}
        </div>
      </SheetContent>
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />
    </Sheet>
  )
}
