import { useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getMyProfile,
  updateProfile,
  PHONE_PATTERN,
} from '@/lib/services/identity'
import { useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Checkout/reservation gate (mobile parity): the customer must have a name
 * and a valid phone number on file so staff can reach them. Returns a
 * `ensureProfileComplete()` that resolves true once the profile is complete,
 * plus the dialog element to render.
 */
export function useProfileGate() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [initialName, setInitialName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const ensureProfileComplete = async (): Promise<boolean> => {
    if (!auth.isAuthenticated) return false
    const profile = await getMyProfile().catch(() => null)
    const name = profile?.name?.trim() ?? ''
    const phone = profile?.phoneNumber?.trim() ?? ''
    if (name && PHONE_PATTERN.test(phone)) return true

    setInitialName(name || auth.user?.profile?.name || '')
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
      key={`${open}`}
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
  initialName: string
  initialPhone: string
  onSettle: (ok: boolean) => void
}) {
  const t = useT()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('fillAllFields'))
      return
    }
    if (!PHONE_PATTERN.test(phone.trim())) {
      setError(t('invalidPhone'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateProfile(name.trim(), phone.trim())
      toast.success(t('profileUpdatedSuccessfully'))
      onSettle(true)
    } catch {
      toast.error(t('failedToUpdateProfile'))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSettle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('completeYourInfo')}</DialogTitle>
          <DialogDescription>{t('profileRequiredMessage')}</DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='gateName'>{t('name')}</Label>
            <Input
              id='gateName'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='gatePhone'>{t('phoneNumber')}</Label>
            <Input
              id='gatePhone'
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
          <Button variant='outline' onClick={() => onSettle(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
