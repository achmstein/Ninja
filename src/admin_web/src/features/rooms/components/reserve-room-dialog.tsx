import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Loader2, Search, X } from 'lucide-react'
import { type RoomViewModel } from '@/api/spaces'
import {
  assignCustomerToSessionMutation,
  reserveRoomMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CustomerSearchDialog } from '@/features/accounts/components/customer-search-dialog'
import type { KeycloakUser } from '@/features/accounts/types'

interface ReserveRoomDialogProps {
  room: RoomViewModel | null
  onOpenChange: (open: boolean) => void
}

function displayName(user: KeycloakUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || user.username
}

export function ReserveRoomDialog({
  room,
  onOpenChange,
}: ReserveRoomDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customer, setCustomer] = useState<KeycloakUser | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')

  const reserve = useMutation(reserveRoomMutation())
  const assignCustomer = useMutation(assignCustomerToSessionMutation())
  const isSaving = reserve.isPending || assignCustomer.isPending

  const reset = () => {
    setCustomer(null)
    setCustomerName('')
    setNotes('')
  }

  const handleReserve = async () => {
    // A picked customer's account name is the reservation name; the free-text
    // field only applies to walk-in guests
    const reservationName = customer
      ? displayName(customer)
      : customerName.trim()

    try {
      const reservationId = await reserve.mutateAsync({
        path: { roomId: Number(room!.id) },
        body: {
          customerName: reservationName || null,
          notes: notes.trim() || null,
        },
      })

      // Link the reservation to the picked account so it shows up in their
      // app and history
      if (customer) {
        await assignCustomer.mutateAsync({
          path: { sessionId: Number(reservationId) },
          body: {
            customerId: customer.id,
            customerName: reservationName,
          },
        })
      }

      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getActiveSessions' }],
      })
      toast.success(t('roomReserved', { name: localized(room?.name) }))
      reset()
      onOpenChange(false)
    } catch {
      toast.error(t('failedToReserveRoom'))
    }
  }

  if (!room) return null

  return (
    <>
      <Dialog open={!!room} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CalendarClock className='h-5 w-5' />
              {t('reserveRoomTitle', { name: localized(room.name) })}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label>{t('customer')}</Label>
              {customer ? (
                <div className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'>
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>
                      {displayName(customer)}
                    </p>
                    {customer.email && (
                      <p className='text-muted-foreground truncate text-xs'>
                        {customer.email}
                      </p>
                    )}
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-7 shrink-0'
                    aria-label={t('clearCustomer')}
                    onClick={() => setCustomer(null)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ) : (
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() => setPickerOpen(true)}
                >
                  <Search className='me-2 h-4 w-4' />
                  {t('findRegisteredCustomer')}
                </Button>
              )}
            </div>

            {!customer && (
              <div className='space-y-2'>
                <Label htmlFor='reserveName'>{t('guestName')}</Label>
                <Input
                  id='reserveName'
                  placeholder={t('guestNamePlaceholder')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='reserveNotes'>{t('notesOptional')}</Label>
              <Textarea
                id='reserveNotes'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleReserve} disabled={isSaving}>
              {isSaving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
              {t('reserve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerSearchDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectCustomer={(picked) => {
          setCustomer(picked)
          setCustomerName('')
        }}
      />
    </>
  )
}
