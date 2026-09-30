import { useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Loader2, Phone } from 'lucide-react'
import { usePhoneRule } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { getMyProfile, hasWholeName, namePartsOf, updateProfile } from '@/lib/services/identity'
import { toast } from '@/lib/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pillAction, pillCancel, sheetFooterClass } from '@/components/ui/ninja-sheet'
import { NameFields } from './name-fields'

/**
 * Checkout/reservation gate (mobile parity): the customer must have a name
 * and a valid phone number on file so staff can reach them. Returns a
 * `ensureProfileComplete()` that resolves true once the profile is complete,
 * plus the dialog element to render.
 */
export function useProfileGate() {
  const auth = useAuth()
  const phonePattern = usePhoneRule((s) => s.pattern)

  const [open, setOpen] = useState(false)
  const [initialName, setInitialName] = useState<[string, string]>(['', ''])
  const [initialPhone, setInitialPhone] = useState('')
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const ensureProfileComplete = async (): Promise<boolean> => {
    if (!auth.isAuthenticated) return false
    const profile = await getMyProfile().catch(() => null)
    const phone = profile?.phoneNumber?.trim() ?? ''
    // First and last name both, and a phone: an Apple account, which may come with no name or half
    // of one, is asked for what it lacks (the fields start from whatever is there)
    if (hasWholeName(profile) && phonePattern.test(phone)) return true

    setInitialName(namePartsOf(profile, auth.user?.profile?.name))
    setInitialPhone(phone)
    setOpen(true)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }

  const settle = (ok: boolean) => {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }

  const dialog = (
    <ProfileGateDialog
      // A fresh dialog each time it opens, so the fields start from the
      // stored values; prefixed, since two gates can sit side by side in one
      // page and their closed keys would otherwise collide
      key={`profile-gate-${open}`}
      open={open}
      initialName={initialName}
      initialPhone={initialPhone}
      onSettle={settle}
    />
  )

  return { ensureProfileComplete, profileGateDialog: dialog }
}

function ProfileGateDialog({
  open,
  initialName,
  initialPhone,
  onSettle,
}: {
  open: boolean
  initialName: [string, string]
  initialPhone: string
  onSettle: (ok: boolean) => void
}) {
  const t = useT()
  const [first, setFirst] = useState(initialName[0])
  const [last, setLast] = useState(initialName[1])
  const phonePattern = usePhoneRule((s) => s.pattern)
  // The business's country's own shape (Tenant.API's phone rules); none where it has none, not another country's
  const phonePlaceholder = usePhoneRule((s) => s.placeholder)

  const [phone, setPhone] = useState(initialPhone)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!first.trim() || !last.trim()) {
      setError(t('fillAllFields'))
      return
    }
    if (!phonePattern.test(phone.trim())) {
      setError(t('invalidPhone'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateProfile(first.trim(), last.trim(), phone.trim())
      toast.success(t('profileUpdatedSuccessfully'))
      onSettle(true)
    } catch {
      toast.error(t('failedToUpdateProfile'))
      setSaving(false)
    }
  }

  // Only what is missing is asked for: a customer whose name is on file sees the phone alone, first
  // thing under the title, rather than under two name fields they did not need to touch
  const [needName] = useState(() => !initialName[0].trim() || !initialName[1].trim())
  const phoneField = (
    <div className='flex flex-col gap-2'>
      <Label htmlFor='gatePhone'>{t('phoneNumber')}</Label>
      <div className='relative'>
        <Phone className='text-muted-foreground pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2' />
        <Input
          id='gatePhone'
          type='tel'
          inputMode='tel'
          autoComplete='tel'
          dir='ltr'
          // The first thing to fill when it is the only one: the keyboard comes up on it
          autoFocus={!needName}
          placeholder={phonePlaceholder || undefined}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={error === t('invalidPhone') || undefined}
          className='ps-11 rtl:text-right'
        />
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSettle(false)}>
      <DialogContent onOpenAutoFocus={(e) => needName && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('completeYourInfo')}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
        >
          {needName && <NameFields idPrefix='gate' first={first} last={last} onFirst={setFirst} onLast={setLast} />}
          {phoneField}
          {error && <p className='text-destructive text-note'>{error}</p>}
          <div className={sheetFooterClass}>
            <button type='button' onClick={() => onSettle(false)} className={pillCancel}>
              {t('cancel')}
            </button>
            <button type='submit' disabled={saving} className={pillAction}>
              {saving && <Loader2 className='size-4 animate-spin' />}
              {t('done')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
