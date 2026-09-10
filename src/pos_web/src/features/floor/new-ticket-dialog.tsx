import { useEffect, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ShoppingBag, User, UserPlus, X } from 'lucide-react'
import { openTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import type { SaleCustomer } from '@/features/sale/cart'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_VERSION, apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Highlight, matchRanges, phoneRanges } from '@/lib/highlight'
import { TICKET_TYPE_COUNTER } from '@/lib/ticket-types'

type NewTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type IdentityUser = {
  id: string
  username?: string
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

/** Where a new tab remembers the account it was opened for, so the sale pad
 *  pre-selects them and the round lands on their tab. Read once, then cleared. */
export function pendingTicketCustomerKey(ticketId: number | string) {
  return `pos.ticket.${ticketId}.customer`
}

/**
 * Opens a counter tab: a bill with no place, named after whoever it is for.
 * Typing looks up accounts — pick one to open the tab for them so the round
 * goes on their tab, or just use the typed name for a walk-in. The name is
 * optional; leave it blank for an unnamed tab.
 */
export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  // The account this tab is being opened for, once one is picked
  const [picked, setPicked] = useState<SaleCustomer | null>(null)

  useEffect(() => {
    if (!open) {
      setLabel('')
      setPicked(null)
      setDebounced('')
    }
  }, [open])

  // Debounced search on the typed name, unless an account is already picked
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(label.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [label])

  const search =
    !picked && debounced.length >= MIN_SEARCH_LENGTH ? debounced : ''
  const { data: users = [] } = useQuery({
    queryKey: ['identityUserSearch', search],
    queryFn: async () => {
      const response = await apiClient.get<IdentityUser[]>(
        '/api/identity/users',
        { params: { search, excludeRole: 'Admin,Owner,Cashier', max: 20 } }
      )
      return response.data
    },
    // Keep the previous matches on screen while the next query loads, so the
    // list doesn't blank and rebind on every keystroke.
    placeholderData: keepPreviousData,
    enabled: open && search.length > 0,
  })

  const openTicket = useMutation({
    ...openTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      // Client-side link: the tab has no customer field, so remember the
      // picked account for the sale pad to pre-select when items are added.
      if (picked?.id) {
        try {
          localStorage.setItem(
            pendingTicketCustomerKey(result.ticketId),
            JSON.stringify(picked)
          )
        } catch {
          // A browser refusing storage just loses the pre-selection
        }
      }
      onOpenChange(false)
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  const openCounter = () =>
    openTicket.mutate({
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_COUNTER,
        label: picked?.name ?? (label.trim() || null),
      },
    })

  const pick = (user: IdentityUser) => {
    const name = displayName(user)
    setPicked({ id: user.id, name, phone: user.phoneNumber })
    setLabel(name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-5 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('newTab')}</DialogTitle>
          <DialogDescription className='text-base'>
            {t('newTabHint')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-2'>
          <Label htmlFor='tab-label'>
            {t('tabName')}{' '}
            <span className='text-muted-foreground font-normal'>
              ({t('optional')})
            </span>
          </Label>
          <Input
            id='tab-label'
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (picked) setPicked(null)
            }}
            className='h-12 text-base'
            autoComplete='off'
            onKeyDown={(e) => {
              if (e.key === 'Enter') openCounter()
            }}
          />

          {picked?.id ? (
            <div className='bg-accent/50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm'>
              <User className='size-4 shrink-0' />
              <span className='min-w-0 flex-1 truncate'>
                {t('onCustomerTabHint', { name: picked.name })}
              </span>
              <button
                type='button'
                aria-label={t('removeCustomer')}
                onClick={() => setPicked(null)}
                className='text-muted-foreground shrink-0'
              >
                <X className='size-4' />
              </button>
            </div>
          ) : (
            search.length > 0 &&
            users.length > 0 && (
              <div className='mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto'>
                {users.map((user) => (
                  <button
                    key={user.id}
                    type='button'
                    onClick={() => pick(user)}
                    className={cn(
                      'hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2 text-start'
                    )}
                  >
                    <UserPlus className='text-muted-foreground size-4 shrink-0' />
                    <span className='min-w-0 flex-1'>
                      {/* The matched letters marked, so the eye lands on the
                          right person without reading every row */}
                      <span className='block truncate font-medium'>
                        <Highlight
                          text={displayName(user)}
                          ranges={matchRanges(displayName(user), label)}
                        />
                      </span>
                      {user.phoneNumber && (
                        <span className='text-muted-foreground block truncate text-xs'>
                          <Highlight
                            text={user.phoneNumber}
                            ranges={phoneRanges(user.phoneNumber, label)}
                          />
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <DialogFooter className='gap-2'>
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            size='lg'
            className='h-12 px-6'
            disabled={openTicket.isPending}
            onClick={openCounter}
          >
            {openTicket.isPending ? (
              <Loader2 className='size-5 animate-spin' />
            ) : (
              <ShoppingBag className='size-5' />
            )}
            {t('openTicketAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
