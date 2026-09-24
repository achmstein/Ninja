import { usePhoneRule } from '@/lib/brand'
import { useRef, useState } from 'react'
import { useGuestStore, type GuestContact } from '@/stores/guest-store'
import { useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Checkout gate for a customer with no account — the guest counterpart of
 * `useProfileGate`. It asks for the same name and phone that gate enforces on
 * a profile, because staff need to reach whoever ordered either way; the
 * difference is only where it is stored (on the order, not on a Keycloak user).
 *
 * Returns `ensureGuestDetails()`, resolving to the contact once given, plus the
 * dialog element to render.
 */
export function useGuestGate() {
  const [open, setOpen] = useState(false)
  const phonePattern = usePhoneRule((s) => s.pattern)

  const contact = useGuestStore((s) => s.contact)
  const setContact = useGuestStore((s) => s.setContact)
  const resolver = useRef<((contact: GuestContact | null) => void) | null>(null)

  const ensureGuestDetails = async (): Promise<GuestContact | null> => {
    // A returning guest already gave these; don't ask on every round
    if (contact?.name.trim() && phonePattern.test(contact.phone.trim())) {
      return contact
    }

    setOpen(true)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }

  const settle = (result: GuestContact | null) => {
    setOpen(false)
    if (result) setContact(result)
    resolver.current?.(result)
    resolver.current = null
  }

  const dialog = (
    <GuestGateDialog
      // A fresh dialog each time it opens, so the fields start from the
      // stored values; prefixed, since two gates can sit side by side in one
      // page and their closed keys would otherwise collide
      key={`guest-gate-${open}`}
      open={open}
      initialName={contact?.name ?? ''}
      initialPhone={contact?.phone ?? ''}
      onSettle={settle}
    />
  )

  return { ensureGuestDetails, guestGateDialog: dialog }
}

function GuestGateDialog({
  open,
  initialName,
  initialPhone,
  onSettle,
}: {
  open: boolean
  initialName: string
  initialPhone: string
  onSettle: (contact: GuestContact | null) => void
}) {
  const t = useT()
  const [name, setName] = useState(initialName)
  const phonePattern = usePhoneRule((s) => s.pattern)

  const [phone, setPhone] = useState(initialPhone)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!name.trim()) {
      setError(t('fillAllFields'))
      return
    }
    if (!phonePattern.test(phone.trim())) {
      setError(t('invalidPhone'))
      return
    }
    setError(null)
    onSettle({ name: name.trim(), phone: phone.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSettle(null)}>
      {/* No auto-focus: on a phone that would raise the keyboard over the
          sheet before the customer has read what is being asked */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('completeYourInfo')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='guestName'>{t('name')}</Label>
            <Input
              id='guestName'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='guestPhone'>{t('phoneNumber')}</Label>
            <Input
              id='guestPhone'
              type='tel'
              dir='ltr'
              placeholder='01XXXXXXXXX'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className='text-destructive text-sm'>{error}</p>}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onSettle(null)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
