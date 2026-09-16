import { useState } from 'react'
import { CalendarClock, Loader2, Search, X } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useStayActions } from '../use-places'

interface HoldDialogProps {
  place: PlaceViewModel | null
  onOpenChange: (open: boolean) => void
}

function displayName(user: KeycloakUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || user.username
}

/**
 * Holds a free timed place for someone on their way: a picked account or a
 * typed name, and whether the clock should start the moment the counter
 * confirms they arrived.
 */
export function HoldDialog({ place, onOpenChange }: HoldDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useStayActions()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customer, setCustomer] = useState<KeycloakUser | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [startOnConfirm, setStartOnConfirm] = useState(false)

  const reset = () => {
    setCustomer(null)
    setCustomerName('')
    setNotes('')
    setStartOnConfirm(false)
  }

  const handleHold = () => {
    if (!place) return
    // A picked customer's account name is the hold's name; the free-text
    // field only applies to guests without an account
    const holdName = customer ? displayName(customer) : customerName.trim()
    const placeName = localized(place.name)
    actions.hold(
      Number(place.id),
      {
        customerName: holdName || null,
        notes: notes.trim() || null,
        startOnConfirm,
      },
      {
        onSuccess: (stayId) => {
          const finish = () => {
            toast.success(t('placeHeld', { name: placeName }))
            reset()
            onOpenChange(false)
          }
          // Link the hold to the picked account so it shows up in their
          // app and history
          if (customer) {
            actions.assignCustomer(stayId, customer.id, holdName, {
              onSuccess: finish,
            })
          } else {
            finish()
          }
        },
      }
    )
  }

  if (!place) return null

  return (
    <>
      <Dialog open={!!place} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CalendarClock className='h-5 w-5' />
              {t('holdPlaceTitle', { name: localized(place.name) })}
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
                <Label htmlFor='holdName'>{t('guestName')}</Label>
                <Input
                  id='holdName'
                  placeholder={t('guestNamePlaceholder')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            )}

            <div className='flex items-center gap-2'>
              <Checkbox
                id='holdStartOnConfirm'
                checked={startOnConfirm}
                onCheckedChange={(checked) =>
                  setStartOnConfirm(checked === true)
                }
              />
              <Label htmlFor='holdStartOnConfirm' className='font-normal'>
                {t('startOnConfirm')}
              </Label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='holdNotes'>{t('notesOptional')}</Label>
              <Textarea
                id='holdNotes'
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
            <Button onClick={handleHold} disabled={actions.isBusy}>
              {actions.isBusy && (
                <Loader2 className='me-2 h-4 w-4 animate-spin' />
              )}
              {t('hold')}
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
