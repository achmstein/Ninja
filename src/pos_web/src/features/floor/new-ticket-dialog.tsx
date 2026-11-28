import { useEffect, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ShoppingBag, X } from 'lucide-react'
import { getOpenTicketsOptions, openTicketMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { TICKET_TYPE_COUNTER } from '@/lib/ticket-types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CustomerSearch } from '@/features/customer/customer-search'
import { ChooseCustomerButton, SelectedCustomer } from '@/features/customer/selected-customer'
import { billLabel } from '@/features/deliveries/delivery-format'
import { STAY_RUNNING } from '@/features/places/status'
import { usePlaces } from '@/features/places/use-places'
import type { SaleCustomer } from '@/features/sale/cart'

type NewTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Where a new tab remembers the account it was opened for, so the sale pad
 *  pre-selects them and the round lands on their tab. Read once, then cleared. */
export function pendingTicketCustomerKey(ticketId: number | string) {
  return `pos.ticket.${ticketId}.customer`
}

/** The account a tab was opened for on this till but who has not ordered
 *  yet — that link only lives here until the first round lands. */
function readPendingCustomerId(ticketId: number | string): string | null {
  try {
    const raw = localStorage.getItem(pendingTicketCustomerKey(ticketId))
    return raw ? ((JSON.parse(raw) as SaleCustomer).id ?? null) : null
  } catch {
    return null
  }
}

/**
 * Opens a counter tab: a bill with no place, for whoever it is for. The
 * customer is chosen exactly as on the sale pad — the same picker (search
 * by name or number, a walk-in's typed name, a new counter customer with
 * its duplicate check) and the same card once picked — so the round goes
 * on their tab. With nobody picked, the tab can still carry a name, or
 * none. Accounts that already have a bill running (on a tab, at a table,
 * in a room) show greyed out in the picker with the bill they are on, so
 * the cashier sees they exist but cannot open a second one: one person,
 * one bill.
 */
export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  // Who this tab is being opened for, once picked: an account, or a
  // walk-in's name from the picker
  const [customer, setCustomer] = useState<SaleCustomer | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Who the bill being opened right now is for: read when the server answers
  const openingFor = useRef<SaleCustomer | null>(null)

  useEffect(() => {
    if (!open) {
      setLabel('')
      setCustomer(null)
    }
  }, [open])

  // Who already has a bill, and where: whoever is on an open bill's lines,
  // whoever is in a room right now, and whoever a tab was just opened for on
  // this till
  const { data: openTickets = [] } = useQuery({
    ...getOpenTicketsOptions(),
    enabled: open,
  })
  const { stays } = usePlaces({ enabled: open })
  const busy = new Map<string, string>()
  for (const ticket of openTickets) {
    const where = localized(ticket.locationName) || billLabel(ticket.label).text || t('counter')
    for (const id of ticket.customerIds ?? []) busy.set(id, where)
    if (ticket.id !== undefined) {
      const pendingId = readPendingCustomerId(ticket.id)
      if (pendingId) busy.set(pendingId, where)
    }
  }
  for (const stay of stays) {
    if (Number(stay.status) !== STAY_RUNNING) continue
    const where = localized(stay.placeName) || t('room')
    for (const member of stay.members ?? []) {
      if (member.customerId) busy.set(member.customerId, where)
    }
  }

  const openTicket = useMutation({
    ...openTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      // Client-side link: the tab has no customer field, so remember the
      // picked account for the sale pad to pre-select when items are added.
      const who = openingFor.current
      if (who?.id) {
        try {
          localStorage.setItem(pendingTicketCustomerKey(result.ticketId), JSON.stringify(who))
        } catch {
          // A browser refusing storage just loses the pre-selection
        }
      }
      onOpenChange(false)
      // A new bill has nothing on it yet: straight to the pad, pointed at it
      navigate({ to: '/order/$ticketId', params: { ticketId: String(result.ticketId) } })
    },
  })

  /** Opens the tab: for the customer given, else the one picked, else under the name typed */
  const openCounter = (who: SaleCustomer | null = customer) => {
    openingFor.current = who
    openTicket.mutate({
      headers: { 'x-requestid': crypto.randomUUID() },
      body: {
        type: TICKET_TYPE_COUNTER,
        label: who?.name ?? (label.trim() || null),
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-5'>
        <DialogHeader>
          <DialogTitle className='type-title'>{t('newTab')}</DialogTitle>
        </DialogHeader>

        {customer ? (
          <SelectedCustomer customer={customer} onRemove={() => setCustomer(null)} />
        ) : (
          <>
            <ChooseCustomerButton onClick={() => setPickerOpen(true)} />
            {/* Nobody picked: the tab can still carry a name */}
            <div className='grid gap-2'>
              <Label htmlFor='tab-label'>
                {t('tabName')} <span className='text-muted-foreground font-normal'>({t('optional')})</span>
              </Label>
              <div className='relative'>
                <Input
                  id='tab-label'
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className='h-12 pe-10 text-base'
                  autoComplete='off'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openCounter()
                  }}
                />
                {label && (
                  <button
                    type='button'
                    aria-label={t('clear')}
                    onClick={() => setLabel('')}
                    className='text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2'
                  >
                    <X className='size-4' />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter className='gap-2'>
          <Button variant='outline' size='lg' className='h-12' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button size='lg' className='h-12 px-6' disabled={openTicket.isPending} onClick={() => openCounter()}>
            {openTicket.isPending ? <Loader2 className='size-5 animate-spin' /> : <ShoppingBag className='size-5' />}
            {t('openTicketAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CustomerSearch
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        // Picking who it is for opens their bill at once: there is nothing left to say
        onPick={(picked) => {
          setCustomer(picked)
          openCounter(picked)
        }}
        busy={busy}
      />
    </Dialog>
  )
}
