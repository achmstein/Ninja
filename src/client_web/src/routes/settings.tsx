import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { KeyRound, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/services/notifications'
import {
  changePassword,
  deleteAccount,
  getMyProfile,
  updateProfile,
  PHONE_PATTERN,
} from '@/lib/services/identity'
import { useT } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { BackHeader } from '@/components/back-header'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { TileButton } from '@/components/tile-row'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const profile = auth.user?.profile
  const name = profile?.name || profile?.preferred_username

  const myProfileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
    enabled: auth.isAuthenticated,
    retry: false,
  })

  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    enabled: auth.isAuthenticated,
    retry: false,
  })

  const savePreferences = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (next: NotificationPreferences) => {
      await queryClient.cancelQueries({
        queryKey: ['notification-preferences'],
      })
      queryClient.setQueryData(['notification-preferences'], next)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      toast.error(t('anErrorOccurred'))
    },
  })

  const removeAccount = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success(t('accountDeletedSuccessfully'))
      auth.signoutRedirect()
    },
    onError: () => toast.error(t('failedToDeleteAccount')),
  })

  const preferences = preferencesQuery.data

  return (
    <div className='flex flex-col gap-4 p-4'>
      <BackHeader title={t('settings')} />

      {/* Notifications — tile rows with switches, like the app */}
      {auth.isAuthenticated && preferences && (
        <section className='flex flex-col gap-2'>
          <h2 className='text-muted-foreground px-1 text-sm font-semibold'>
            {t('notifications')}
          </h2>
          <Card className='gap-0 divide-y p-0'>
            <div className='flex items-center justify-between gap-3 p-4'>
              <div className='min-w-0'>
                <div className='text-[15px] font-medium'>
                  {t('orderStatusUpdates')}
                </div>
                <p className='text-muted-foreground text-[13px]'>
                  {t('orderStatusUpdatesDescription')}
                </p>
              </div>
              <Switch
                checked={preferences.orderStatusUpdates}
                onCheckedChange={(checked) =>
                  savePreferences.mutate({
                    ...preferences,
                    orderStatusUpdates: checked,
                  })
                }
              />
            </div>
            <div className='flex items-center justify-between gap-3 p-4'>
              <div className='min-w-0'>
                <div className='text-[15px] font-medium'>
                  {t('promotionsAndOffers')}
                </div>
                <p className='text-muted-foreground text-[13px]'>
                  {t('promotionsDescription')}
                </p>
              </div>
              <Switch
                checked={preferences.promotionsAndOffers}
                onCheckedChange={(checked) =>
                  savePreferences.mutate({
                    ...preferences,
                    promotionsAndOffers: checked,
                  })
                }
              />
            </div>
          </Card>
        </section>
      )}

      {/* Appearance & language */}
      <section className='flex flex-col gap-2'>
        <h2 className='text-muted-foreground px-1 text-sm font-semibold'>
          {t('appearance')}
        </h2>
        <Card className='gap-0 divide-y p-0'>
          <div className='flex items-center justify-between p-4'>
            <span className='text-[15px] font-medium'>{t('theme')}</span>
            <ThemeSwitch />
          </div>
          <div className='flex items-center justify-between p-4'>
            <span className='text-[15px] font-medium'>{t('language')}</span>
            <LanguageSwitch />
          </div>
        </Card>
      </section>

      {/* Account */}
      {auth.isAuthenticated && (
        <section className='flex flex-col gap-2'>
          <h2 className='text-muted-foreground px-1 text-sm font-semibold'>
            {t('account')}
          </h2>
          <Card className='gap-0 divide-y p-0'>
            <TileButton
              icon={Pencil}
              label={t('updateProfile')}
              onClick={() => setEditOpen(true)}
            />
            <TileButton
              icon={KeyRound}
              label={t('changePassword')}
              onClick={() => setPasswordOpen(true)}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <TileButton
                  icon={Trash2}
                  label={t('deleteAccount')}
                  destructive
                  disabled={removeAccount.isPending}
                />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteAccount')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteAccountConfirmation')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    onClick={() => removeAccount.mutate()}
                  >
                    {t('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        </section>
      )}

      <UpdateProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialName={myProfileQuery.data?.name ?? name ?? ''}
        initialPhone={myProfileQuery.data?.phoneNumber ?? ''}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['my-profile'] })
        }}
      />
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </div>
  )
}

function UpdateProfileDialog({
  open,
  onOpenChange,
  initialName,
  initialPhone,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  initialPhone: string
  onSaved: () => void
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
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error(t('failedToUpdateProfile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (o) {
          setName(initialName)
          setPhone(initialPhone)
          setError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('updateProfile')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='profileName'>{t('name')}</Label>
            <Input
              id='profileName'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='profilePhone'>{t('phoneNumber')}</Label>
            <Input
              id='profilePhone'
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
          <Button variant='outline' onClick={() => onOpenChange(false)}>
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

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (password.length < 8) {
      setError(t('passwordMustBe8Chars'))
      return
    }
    if (password !== confirm) {
      setError(t('passwordsDontMatch'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await changePassword(password)
      toast.success(t('passwordChangedSuccessfully'))
      setPassword('')
      setConfirm('')
      onOpenChange(false)
    } catch {
      toast.error(t('failedToChangePassword'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changePassword')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='newPassword'>{t('newPassword')}</Label>
            <Input
              id='newPassword'
              type='password'
              placeholder={t('enterNewPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>{t('confirmPassword')}</Label>
            <Input
              id='confirmPassword'
              type='password'
              placeholder={t('confirmYourPassword')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className='text-destructive text-sm'>{error}</p>}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
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
