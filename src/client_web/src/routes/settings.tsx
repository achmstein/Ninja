import { useState } from 'react'
import { NameFields } from '@/components/name-fields'
import { usePhoneRule } from '@/lib/brand'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { BellRing, Download, KeyRound, Loader2, Megaphone, Pencil, Trash2 } from 'lucide-react'
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
  namePartsOf,
  updateProfile,
} from '@/lib/services/identity'
import { useT } from '@/lib/i18n'
import { useInstallPrompt } from '@/lib/use-install-prompt'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { SectionLabel } from '@/components/ninja/page/parts'
import { InstallDialog } from '@/components/install-dialog'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { TileButton, TileGroup, TileRow } from '@/components/tile-row'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)

  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()

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
    <NinjaPage title={t('settings')} back='/profile' push='settings'>
      <Rise className='flex flex-col gap-5'>
        {/* Notifications: rows with switches, like the app */}
        {auth.isAuthenticated && preferences && (
          <RiseItem className='flex flex-col gap-2'>
            <SectionLabel>{t('notifications')}</SectionLabel>
            <TileGroup>
              <TileRow
                icon={BellRing}
                label={t('orderStatusUpdates')}
                trailing={
                  <Switch
                    checked={preferences.orderStatusUpdates}
                    onCheckedChange={(checked) => savePreferences.mutate({ ...preferences, orderStatusUpdates: checked })}
                  />
                }
              />
              <TileRow
                icon={Megaphone}
                label={t('promotionsAndOffers')}
                trailing={
                  <Switch
                    checked={preferences.promotionsAndOffers}
                    onCheckedChange={(checked) => savePreferences.mutate({ ...preferences, promotionsAndOffers: checked })}
                  />
                }
              />
            </TileGroup>
          </RiseItem>
        )}

        <RiseItem className='flex flex-col gap-2'>
          <SectionLabel>{t('appearance')}</SectionLabel>
          <TileGroup>
            <ThemeSwitch />
            <LanguageSwitch />
            {/* Android: the native prompt. iOS: the share-sheet walkthrough.
                Nothing once installed, or where neither route exists */}
            {(canInstall || (isIos && !isStandalone)) && (
              <TileButton
                icon={Download}
                label={t('installApp')}
                onClick={() => {
                  if (canInstall) void install()
                  else setInstallOpen(true)
                }}
              />
            )}
          </TileGroup>
        </RiseItem>

        {/* The profile itself: edit it, its password, delete it. Named as the
            tab is, never "account": that word is the house tab's */}
        {auth.isAuthenticated && (
          <RiseItem className='flex flex-col gap-2'>
            <SectionLabel>{t('profile')}</SectionLabel>
            <TileGroup>
              <TileButton icon={Pencil} label={t('updateProfile')} onClick={() => setEditOpen(true)} />
              <TileButton icon={KeyRound} label={t('changePassword')} onClick={() => setPasswordOpen(true)} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <TileButton icon={Trash2} label={t('deleteAccount')} destructive disabled={removeAccount.isPending} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteAccountQuestion')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('cannotBeUndone')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction className='bg-destructive hover:bg-destructive/90 text-white' onClick={() => removeAccount.mutate()}>
                      {t('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TileGroup>
          </RiseItem>
        )}
      </Rise>

      <UpdateProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialName={namePartsOf(myProfileQuery.data, name)}
        initialPhone={myProfileQuery.data?.phoneNumber ?? ''}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['my-profile'] })
        }}
      />
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
    </NinjaPage>
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
  initialName: [string, string]
  initialPhone: string
  onSaved: () => void
}) {
  const t = useT()
  const [first, setFirst] = useState(initialName[0])
  const [last, setLast] = useState(initialName[1])
  const phonePattern = usePhoneRule((s) => s.pattern)
  // The café's country's own shape (Tenant.API's phone rules); none where it has none, not another country's
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
          setFirst(initialName[0])
          setLast(initialName[1])
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
          <NameFields idPrefix='profile' first={first} last={last} onFirst={setFirst} onLast={setLast} />
          <div className='space-y-2'>
            <Label htmlFor='profilePhone'>{t('phoneNumber')}</Label>
            <Input
              id='profilePhone'
              type='tel'
              dir='ltr'
              placeholder={phonePlaceholder || undefined}
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
