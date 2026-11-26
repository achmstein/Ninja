import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { SaleCustomer } from '@/features/sale/cart'
import { apiClient } from '@/lib/api-client'
import { Highlight, matchRanges } from '@/lib/highlight'
import { useLanguage, useT } from '@/lib/i18n'
import { editablePhone } from '@/lib/phone'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { customerName, type IdentityCustomer } from './counter-customers'
import { looksLikePhone, NewCustomerForm } from './new-customer-form'
import { readRecentCustomers, rememberRecentCustomer } from './recent-customers'

/** How many customers the list holds before a name has to be typed */
const LIST_MAX = 200

/** The letter a name is filed under: its first, an Arabic alef read as one letter however it is written */
function filedUnder(name: string): string {
  const first = Array.from(name.trim())[0] ?? ''
  return /[إآاأ]/.test(first) ? 'أ' : first.toUpperCase()
}

const toCustomer = (user: IdentityCustomer): SaleCustomer => ({
  id: user.id,
  name: customerName(user),
  phone: user.phoneNumber ?? null,
})

const usersQuery = (search: string, max: number) => ({
  queryKey: ['identityUserSearch', search, 'customerSearch', max],
  queryFn: async () =>
    (
      await apiClient.get<IdentityCustomer[]>('/api/identity/users', {
        // A duplicate merged into another customer is not a person to show
        params: { search: search || undefined, excludeRole: 'Admin,Owner,Cashier', merged: false, max },
      })
    ).data,
})

/**
 * Finding a customer by name, on the whole screen: the box on its top row and
 * the results right under it, so a tablet's keyboard only ever covers the
 * empty foot. Nothing needs typing to begin with: the customers picked lately,
 * then everyone by name, with a strip of letters to jump by the first one.
 * The keyboard waits for a tap on the box. A name that is nobody's yet can go
 * on the order as it is, or be added as a customer, which is the only place a
 * phone number is asked.
 */
export function CustomerSearch({
  open,
  onOpenChange,
  onPick,
  exclude = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (customer: SaleCustomer) => void
  /** Accounts not to list: the people the caller already offers */
  exclude?: readonly string[]
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // The keyboard waits for a tap on the box
          onOpenAutoFocus={(e) => e.preventDefault()}
          className='bg-background fixed inset-0 z-[60] flex justify-center outline-none'
        >
          {/* Rendered only while open, so each opening starts clean */}
          {open && (
            <SearchBody
              exclude={exclude}
              onClose={() => onOpenChange(false)}
              onPick={(customer) => {
                rememberRecentCustomer(customer)
                onPick(customer)
                onOpenChange(false)
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SearchBody({
  exclude,
  onClose,
  onPick,
}: {
  exclude: readonly string[]
  onClose: () => void
  onPick: (customer: SaleCustomer) => void
}) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const [term, setTerm] = useState('')
  const [letter, setLetter] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const typed = term.trim()
  const search = useDebounced(typed, 250)
  // Everyone, for the list and the letters; and the matches once a name is typed
  const everyone = useQuery({ ...usersQuery('', LIST_MAX), staleTime: 60_000 })
  const matches = useQuery({ ...usersQuery(search, 20), placeholderData: keepPreviousData, enabled: search !== '' })

  const listed = (users: IdentityCustomer[] | undefined) => (users ?? []).filter((u) => !exclude.includes(u.id))
  const byName = (a: IdentityCustomer, b: IdentityCustomer) => customerName(a).localeCompare(customerName(b), language)
  // The letters names here really start with, each alphabet in its own order: a till in
  // Arabic still has its customers written in English, and the other way round
  const letters = [...new Set(listed(everyone.data).map((u) => filedUnder(customerName(u))))]
    .filter((ch) => /\p{L}/u.test(ch))
    .sort((a, b) => a.localeCompare(b, /[\u0600-\u06FF]/.test(a) ? 'ar' : 'en'))
  // The till's own alphabet first
  const arabicFirst = language === 'ar'
  const isArabic = (ch: string) => /[\u0600-\u06FF]/.test(ch)
  const strip = [...letters.filter((ch) => isArabic(ch) === arabicFirst), ...letters.filter((ch) => isArabic(ch) !== arabicFirst)]

  if (adding) {
    return (
      <Frame>
        <TopRow onBack={() => setAdding(false)}>
          <DialogPrimitive.Title className='min-w-0 flex-1 type-title truncate'>{t('newCustomer')}</DialogPrimitive.Title>
        </TopRow>
        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
          <NewCustomerForm initialText={typed} onPick={(added) => onPick(toCustomer(added))} onCancel={() => setAdding(false)} />
        </div>
      </Frame>
    )
  }

  const row = (user: IdentityCustomer, mark = false) => {
    const name = customerName(user)
    const off = user.enabled === false
    return (
      <button
        key={user.id}
        type='button'
        disabled={off}
        onClick={() => onPick(toCustomer(user))}
        className='hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 type-body text-start disabled:cursor-not-allowed disabled:opacity-50'
      >
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-semibold'>
            <bdi>{mark ? <Highlight text={name} ranges={matchRanges(name, typed)} /> : name}</bdi>
          </span>
          {off && <span className='text-muted-foreground type-detail block truncate'>{t('customerDisabled')}</span>}
        </span>
        {user.phoneNumber && (
          <bdi dir='ltr' className='text-muted-foreground type-detail shrink-0 tabular-nums'>
            {editablePhone(user.phoneNumber)}
          </bdi>
        )}
      </button>
    )
  }

  let body: React.ReactNode
  if (typed !== '') {
    const found = listed(matches.data)
    const waiting = search !== typed || (matches.isFetching && found.length === 0)
    body = (
      <>
        {waiting ? <RowSkeletons /> : found.length > 0 ? found.map((u) => row(u, true)) : <Nothing>{t('customerSearchNone')}</Nothing>}
        {/* A name that is nobody's yet: on this order as it is, or a customer from now on */}
        {!looksLikePhone(typed) && (
          <>
            <Caption>{t('customerSearchNotListed')}</Caption>
            <button
              type='button'
              onClick={() => onPick({ id: null, name: typed })}
              className='hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start'
            >
              <Pencil className='text-muted-foreground size-5 shrink-0' aria-hidden />
              <span className='min-w-0'>
                <span className='type-heading block truncate'>{t('useNameAction', { name: typed })}</span>
                <span className='text-muted-foreground type-detail block truncate'>{t('noAccountNeeded')}</span>
              </span>
            </button>
          </>
        )}
        <button
          type='button'
          onClick={() => setAdding(true)}
          className='hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start'
        >
          <UserPlus className='text-muted-foreground size-5 shrink-0' aria-hidden />
          <span className='min-w-0'>
            <span className='type-heading block truncate'>{t('newCustomer')}</span>
            <span className='text-muted-foreground type-detail block truncate'>{t('customerSearchAddHint')}</span>
          </span>
        </button>
      </>
    )
  } else if (everyone.isLoading) {
    body = <RowSkeletons />
  } else if (everyone.isError) {
    body = <Nothing>{t('somethingWentWrong')}</Nothing>
  } else {
    const all = listed(everyone.data).slice().sort(byName)
    if (letter) {
      const under = all.filter((u) => filedUnder(customerName(u)) === letter)
      body = under.length > 0 ? under.map((u) => row(u)) : <Nothing>{t('customerSearchNone')}</Nothing>
    } else {
      const recent = readRecentCustomers()
        .map((r) => all.find((u) => u.id === r.id))
        .filter((u): u is IdentityCustomer => !!u)
      body = (
        <>
          {recent.length > 0 && (
            <>
              <Caption>{t('recentCustomers')}</Caption>
              {recent.map((u) => row(u))}
            </>
          )}
          <Caption>{t('customerSearchEveryone')}</Caption>
          {all.length > 0 ? all.map((u) => row(u)) : <Nothing>{t('noCustomersFound')}</Nothing>}
          {/* A long list is not for scrolling: past this many, the name is typed */}
          {(everyone.data ?? []).length >= LIST_MAX && <Nothing>{t('customerSearchTypeForMore')}</Nothing>}
        </>
      )
    }
  }

  return (
    <Frame>
      <TopRow onBack={onClose}>
        <DialogPrimitive.Title className='sr-only'>{t('chooseCustomer')}</DialogPrimitive.Title>
        <div className='relative min-w-0 flex-1'>
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              setLetter(null)
            }}
            placeholder={t('customerSearchPlaceholder')}
            className='h-12 pe-12 text-base'
            autoComplete='off'
            enterKeyHint='search'
          />
          {(term !== '' || letter) && (
            <button
              type='button'
              aria-label={t('clear')}
              onClick={() => {
                setTerm('')
                setLetter(null)
              }}
              className='text-muted-foreground hover:text-foreground absolute end-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md'
            >
              <X className='size-5' />
            </button>
          )}
        </div>
      </TopRow>
      {/* A name's first letter, without the keyboard: only letters somebody is filed under */}
      <div className={cn('no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2', strip.length === 0 && 'hidden')} role='toolbar' aria-label={t('customerSearchLetters')}>
        {strip.map((ch) => (
          <button
            key={ch}
            type='button'
            aria-pressed={letter === ch}
            onClick={() => {
              setTerm('')
              setLetter(letter === ch ? null : ch)
            }}
            className={cn(
              'size-10 shrink-0 rounded-lg text-base font-semibold',
              letter === ch ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {ch}
          </button>
        ))}
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]'>{body}</div>
    </Frame>
  )
}

/** A column down the middle: across a whole tablet a row would run from one edge to the other */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className='bg-background flex h-full w-full max-w-2xl flex-col sm:border-x'>{children}</div>
}

function TopRow({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  const t = useT()
  return (
    <div className='flex min-h-16 shrink-0 items-center gap-2 border-b px-2 py-1.5'>
      <Button variant='ghost' size='icon' className='size-12 shrink-0' aria-label={t('goBack')} onClick={onBack}>
        <ArrowLeft className='size-6 rtl:rotate-180' />
      </Button>
      {children}
    </div>
  )
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div className='text-muted-foreground px-4 pt-3 pb-1 type-label'>{children}</div>
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <p className='text-muted-foreground px-4 py-6 type-detail text-center'>{children}</p>
}

function RowSkeletons() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        // A name and a number: a customer row's shape
        <div key={i} className='flex min-h-14 items-center gap-3 border-b px-4 py-2'>
          <Skeleton className='h-4 w-2/5' />
          <Skeleton className='ms-auto h-3 w-24' />
        </div>
      ))}
    </>
  )
}
