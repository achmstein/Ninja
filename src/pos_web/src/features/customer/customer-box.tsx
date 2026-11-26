import { useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Pencil, Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { SaleCustomer } from '@/features/sale/cart'
import { apiClient } from '@/lib/api-client'
import { Highlight, matchRanges, phoneRanges } from '@/lib/highlight'
import { useT } from '@/lib/i18n'
import { editablePhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { customerName, ensureCounterCustomer, useCustomerLookup, type IdentityCustomer } from './counter-customers'
import { InitialsBadge } from './initials-badge'
import { looksLikePhone } from './new-customer-form'
import { SelectedCustomer } from './selected-customer'

const RECENT_KEY = 'pos.recentCustomers'
const RECENT_MAX = 5

/** The customers picked here lately, newest first: most sales are a regular's */
function readRecent(): SaleCustomer[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as SaleCustomer[]) : []
    return Array.isArray(list) ? list.filter((c) => c?.id && c.name) : []
  } catch {
    return []
  }
}

function rememberRecent(customer: SaleCustomer) {
  if (!customer.id) return
  try {
    const rest = readRecent().filter((c) => c.id !== customer.id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([customer, ...rest].slice(0, RECENT_MAX)))
  } catch {
    // A browser that refuses storage only loses the shortcut
  }
}

const toCustomer = (user: IdentityCustomer): SaleCustomer => ({
  id: user.id,
  name: customerName(user),
  phone: user.phoneNumber ?? null,
})

type Row = { key: string; disabled?: boolean; onPick: () => void; body: ReactNode }

/**
 * Who a sale or a round is for, found or added without leaving the order: one
 * box. Tapped, it offers the people already on the bill and the customers
 * picked lately, a tap each. A few letters or digits (the last digits of a
 * number are enough) list the customers that match, Enter taking the first.
 * A whole number nobody has becomes "New customer": the box asks their name,
 * and Enter adds them. A plain name with no account is one row too. Picked,
 * the box is the customer, with a cross to take them off.
 */
export function CustomerBox({
  customer,
  onPick,
  onRemove,
  people = [],
}: {
  customer: SaleCustomer | null
  onPick: (customer: SaleCustomer) => void
  onRemove: () => void
  /** The people already on the bill, offered first */
  people?: SaleCustomer[]
}) {
  const t = useT()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // The number of the customer being added: the box then asks only their name
  const [newPhone, setNewPhone] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  const typed = term.trim()
  const phoneLike = newPhone == null && typed.length > 0 && looksLikePhone(typed)
  const search = useDebounced(newPhone == null && typed.length >= 2 ? typed : '', 250)
  const users = useQuery({
    queryKey: ['identityUserSearch', search, 'box'],
    queryFn: async () =>
      (
        await apiClient.get<IdentityCustomer[]>('/api/identity/users', {
          params: { search, excludeRole: 'Admin,Owner,Cashier', merged: false, max: 8 },
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled: open && search !== '',
  })
  // A whole number: whose it is exactly, or that it is nobody's and may be added
  const lookup = useCustomerLookup(phoneLike ? typed : '', '', open && phoneLike)
  const exact = phoneLike && lookup.data?.phoneValid ? lookup.data : null

  const close = () => {
    setOpen(false)
    setTerm('')
    setNewPhone(null)
    setActive(0)
  }
  const pick = (picked: SaleCustomer) => {
    rememberRecent(picked)
    onPick(picked)
    close()
    field.current?.blur()
  }
  const addNew = async () => {
    const name = typed
    if (!newPhone || name.length === 0 || adding) return
    setAdding(true)
    const added = await ensureCounterCustomer(name, newPhone)
    setAdding(false)
    if (!added) return toast.error(t('somethingWentWrong'))
    pick(toCustomer(added))
  }

  if (customer) return <SelectedCustomer customer={customer} onRemove={onRemove} />

  const person = (c: SaleCustomer, sub?: ReactNode, mark = false) => (
    <>
      <InitialsBadge name={c.name} />
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-medium'>
          {mark ? <Highlight text={c.name} ranges={matchRanges(c.name, typed)} /> : c.name || t('guest')}
        </span>
        {sub ??
          (c.phone ? (
            <bdi dir='ltr' className='text-muted-foreground block truncate text-sm tabular-nums'>
              {mark ? (
                <Highlight text={editablePhone(c.phone)} ranges={phoneRanges(editablePhone(c.phone), typed)} />
              ) : (
                editablePhone(c.phone)
              )}
            </bdi>
          ) : null)}
      </span>
    </>
  )

  // What the list offers now, top to bottom: Enter takes the first that can be taken
  const rows: Row[] = []
  let heading: string | null = null
  const headings = new Map<string, string>()
  const push = (row: Row) => {
    if (heading) headings.set(row.key, heading)
    heading = null
    rows.push(row)
  }
  if (newPhone == null) {
    if (typed.length === 0) {
      heading = people.length > 0 ? t('alsoOnBill') : null
      for (const p of people) push({ key: `bill:${p.id ?? p.name}`, onPick: () => pick(p), body: person(p) })
      const recent = readRecent().filter((r) => !people.some((p) => p.id === r.id))
      heading = recent.length > 0 ? t('recentCustomers') : null
      for (const r of recent) push({ key: `recent:${r.id}`, onPick: () => pick(r), body: person(r) })
    } else {
      const found = (users.data ?? []).filter((u) => u.id !== exact?.match?.id)
      if (exact?.match) {
        const c = toCustomer(exact.match)
        push({ key: `exact:${c.id}`, disabled: exact.match.enabled === false, onPick: () => pick(c), body: person(c, undefined, true) })
      }
      for (const u of search === '' ? [] : found) {
        const c = toCustomer(u)
        const off = u.enabled === false
        push({
          key: `user:${u.id}`,
          disabled: off,
          onPick: () => pick(c),
          body: person(
            c,
            off ? <span className='text-muted-foreground block truncate text-sm'>{t('customerDisabled')}</span> : undefined,
            true,
          ),
        })
      }
      if (exact && !exact.match) {
        // A whole number nobody has: one row makes them a customer, their name is all that is asked
        push({
          key: 'new',
          onPick: () => {
            setNewPhone(exact.phone)
            setTerm('')
            setActive(0)
            field.current?.focus()
          },
          body: (
            <>
              <span className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full'>
                <UserPlus className='size-4' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate font-medium'>{t('newCustomer')}</span>
                <bdi dir='ltr' className='text-muted-foreground block truncate text-sm tabular-nums'>
                  {editablePhone(exact.phone)}
                </bdi>
              </span>
            </>
          ),
        })
      }
      if (!phoneLike) {
        // The waiters know most people by name: the name as typed, no account needed
        push({
          key: 'name',
          onPick: () => pick({ id: null, name: typed }),
          body: (
            <>
              <span className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full'>
                <Pencil className='size-4' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate font-medium'>{t('useNameAction', { name: typed })}</span>
                <span className='text-muted-foreground block truncate text-sm'>{t('noAccountNeeded')}</span>
              </span>
            </>
          ),
        })
      }
    }
  }
  if (newPhone != null && typed.length > 0) {
    // Their name is typed: one row (or Enter) adds them and picks them
    push({
      key: 'add',
      disabled: adding,
      onPick: () => void addNew(),
      body: (
        <>
          <InitialsBadge name={typed} />
          <span className='min-w-0 flex-1'>
            <span className='block truncate font-medium'>{t('customerBoxAdd', { name: typed })}</span>
            <bdi dir='ltr' className='text-muted-foreground block truncate text-sm tabular-nums'>
              {editablePhone(newPhone)}
            </bdi>
          </span>
        </>
      ),
    })
  }
  const takeable = rows.filter((r) => !r.disabled)
  const at = Math.min(active, Math.max(takeable.length - 1, 0))
  const busy = (users.isFetching && search !== '') || (phoneLike && lookup.isFetching) || adding
  const hint =
    newPhone != null
      ? typed.length === 0
        ? t('customerBoxNameHint')
        : null
      : typed.length >= 2 && rows.length === 0 && !busy
        ? t('noCustomersFound')
        : typed.length === 0 && rows.length === 0
          ? t('customerBoxHint')
          : null

  return (
    <div
      className='relative'
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close()
      }}
    >
      <div className='relative'>
        {newPhone != null ? (
          <UserPlus className='text-primary pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2' aria-hidden />
        ) : (
          <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2' aria-hidden />
        )}
        <Input
          ref={field}
          role='combobox'
          aria-expanded={open}
          aria-autocomplete='list'
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (takeable.length > 0) setActive((at + (e.key === 'ArrowDown' ? 1 : takeable.length - 1)) % takeable.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              takeable[at]?.onPick()
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation()
              if (newPhone != null) {
                setNewPhone(null)
                setTerm('')
              } else {
                close()
                field.current?.blur()
              }
            }
          }}
          placeholder={
            newPhone != null ? t('customerBoxNameFor', { phone: editablePhone(newPhone) }) : t('customerBoxPlaceholder')
          }
          className={cn('h-12 ps-10 pe-10 text-base', newPhone != null && 'border-primary')}
          autoComplete='off'
          enterKeyHint={newPhone != null ? 'done' : 'search'}
        />
        {busy ? (
          <Loader2 className='text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin' aria-hidden />
        ) : (
          (term !== '' || newPhone != null) && (
            <button
              type='button'
              aria-label={t('clear')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTerm('')
                setNewPhone(null)
                setActive(0)
              }}
              className='text-muted-foreground hover:text-foreground absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md'
            >
              <X className='size-4' />
            </button>
          )
        )}
      </div>

      {open && (rows.length > 0 || hint) && (
        <div
          role='listbox'
          className='bg-popover text-popover-foreground absolute inset-x-0 top-full z-30 mt-1 max-h-[min(22rem,60svh)] overflow-y-auto rounded-xl border p-1 shadow-lg'
        >
          {rows.map((row) => (
            <div key={row.key}>
              {headings.has(row.key) && (
                <div className='text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase'>
                  {headings.get(row.key)}
                </div>
              )}
              <button
                type='button'
                role='option'
                aria-selected={takeable[at] === row}
                disabled={row.disabled}
                tabIndex={-1}
                // The box keeps the focus, so the list stays open under the tap
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  const index = takeable.indexOf(row)
                  if (index >= 0) setActive(index)
                }}
                onClick={row.onPick}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start disabled:opacity-50',
                  takeable[at] === row && 'bg-muted',
                )}
              >
                {row.body}
              </button>
            </div>
          ))}
          {hint && <p className='text-muted-foreground px-2 py-2 text-sm'>{hint}</p>}
        </div>
      )}
    </div>
  )
}
