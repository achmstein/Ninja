import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
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
}

/**
 * Attach-a-customer search for loyalty accrual and on-account settling.
 * Debounced Keycloak search; admins are excluded server-side so staff
 * accounts never end up as "customers" on a sale.
 */
export function CustomerDialog({
  open,
  onOpenChange,
  onSelect,
}: CustomerDialogProps) {
  const t = useT()
  const [term, setTerm] = useState('')
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
        { params: { search, excludeRole: 'Admin', max: 20 } }
      )
      return response.data
    },
    enabled: open && search.length > 0,
  })

  const pick = (user: IdentityUser) => {
    onSelect({ id: user.id, name: displayName(user) })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85svh] flex-col gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('chooseCustomer')}</DialogTitle>
        </DialogHeader>

        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('searchCustomersPlaceholder')}
          className='h-12 text-base'
          autoComplete='off'
          autoFocus
        />

        <div className='-mx-2 flex-1 overflow-y-auto'>
          {search.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('typeToSearch')}
            </p>
          ) : isFetching ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='text-muted-foreground size-6 animate-spin' />
            </div>
          ) : isError ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('somethingWentWrong')}
            </p>
          ) : users.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('noCustomersFound')}
            </p>
          ) : (
            <div className='flex flex-col'>
              {users.map((user) => (
                <button
                  key={user.id}
                  type='button'
                  onClick={() => pick(user)}
                  className='hover:bg-accent flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-start'
                >
                  <User className='text-muted-foreground size-5 shrink-0' />
                  <span className='min-w-0'>
                    <span className='block truncate text-base font-medium'>
                      {displayName(user)}
                    </span>
                    {(user.phoneNumber || user.email) && (
                      <span className='text-muted-foreground block truncate text-sm'>
                        {user.phoneNumber || user.email}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant='outline'
          size='lg'
          className='h-12'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
