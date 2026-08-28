import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  Award,
  ChevronRight,
  Gamepad2,
  KeyRound,
  LifeBuoy,
  Loader2,
  LogOut,
  Pencil,
  Phone,
  Trash2,
  User,
  Wallet,
} from 'lucide-react'
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
import { useSelectedBranch } from '@/lib/branch'
import { unregisterPush } from '@/lib/use-push'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { LanguageSwitch } from '@/components/language-switch'
import { SignInOptions } from '@/components/sign-in-options'
import { ThemeSwitch } from '@/components/theme-switch'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const t = useT()
  const auth = useAuth()
  const navigate = useNavigate()
  const branch = useSelectedBranch()
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
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('profile')}</h1>

      {/* Identity card */}
      <Card className='flex-row items-center gap-4 p-4'>
        <div className='bg-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-full'>
          <User className='text-muted-foreground h-6 w-6' />
        </div>
        <div className='min-w-0 flex-1'>
          {auth.isAuthenticated ? (
            <>
              <div className='truncate font-semibold'>
                {myProfileQuery.data?.name || name}
              </div>
              <div className='text-muted-foreground truncate text-sm'>
                {myProfileQuery.data?.phoneNumber || profile?.email}
              </div>
            </>
          ) : (
            <div className='text-muted-foreground text-sm'>
              {t('signInPrompt')}
            </div>
          )}
        </div>
        {auth.isAuthenticated && (
          <Button
            variant='ghost'
            size='icon'
            className='rounded-full'
            aria-label={t('updateProfile')}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
        )}
      </Card>

      {/* Navigation rows (mobile IA: loyalty & friends live here) */}
      {auth.isAuthenticated && (
        <Card className='gap-0 divide-y p-0'>
          <ProfileRow
            to='/loyalty'
            icon={Award}
            label={t('loyaltyRewards')}
          />
          <ProfileRow to='/sessions' icon={Gamepad2} label={t('sessions')} />
          <ProfileRow to='/account' icon={Wallet} label={t('transactions')} />
        </Card>
      )}

      {/* Notifications */}
      {auth.isAuthenticated && preferences && (
        <Card className='gap-4 p-4'>
          <h2 className='text-sm font-semibold'>{t('notifications')}</h2>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <div className='text-sm font-medium'>
                {t('orderStatusUpdates')}
              </div>
              <p className='text-muted-foreground text-xs'>
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
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <div className='text-sm font-medium'>
                {t('promotionsAndOffers')}
              </div>
              <p className='text-muted-foreground text-xs'>
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
      )}

      {/* Appearance & language */}
      <Card className='gap-3 p-4'>
        <h2 className='text-sm font-semibold'>{t('appearance')}</h2>
        <div className='flex items-center justify-between'>
          <span className='text-sm'>{t('theme')}</span>
          <ThemeSwitch />
        </div>
        <Separator />
        <div className='flex items-center justify-between'>
          <span className='text-sm'>{t('language')}</span>
          <LanguageSwitch />
        </div>
      </Card>

      {/* Help & support */}
      <Card className='gap-3 p-4'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <LifeBuoy className='h-4 w-4' />
          {t('helpAndSupport')}
        </h2>
        <p className='text-muted-foreground text-xs'>{t('needHelpContactUs')}</p>
        <div className='text-sm'>
          {/* Isolate the digits so RTL text doesn't reorder the groups */}
          <div>
            <span dir='ltr'>{t('supportPhone')}</span>
          </div>
          <div>{t('supportEmail')}</div>
          <div className='text-muted-foreground text-xs'>
            {t('supportHours')}
          </div>
        </div>
        {branch?.phone && (
          <Button asChild variant='outline' className='rounded-full'>
            <a href={`tel:${branch.phone}`}>
              <Phone className='h-4 w-4' />
              {t('callUs')}
            </a>
          </Button>
        )}
      </Card>

      {/* Account actions */}
      {auth.isAuthenticated ? (
        <Card className='gap-3 p-4'>
          <h2 className='text-sm font-semibold'>{t('account')}</h2>
          <Button
            variant='outline'
            className='justify-start rounded-full'
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRound className='h-4 w-4' />
            {t('changePassword')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant='outline'
                className='text-destructive justify-start rounded-full'
                disabled={removeAccount.isPending}
              >
                <Trash2 className='h-4 w-4' />
                {t('deleteAccount')}
              </Button>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='outline' className='justify-start rounded-full'>
                <LogOut className='h-4 w-4' />
                {t('signOut')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('signOutConfirmation')}</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await unregisterPush()
                    auth.signoutRedirect()
                  }}
                >
                  {t('signOut')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      ) : (
        <div className='flex flex-col items-center gap-3 py-4'>
          <p className='text-muted-foreground text-sm'>{t('signInPrompt')}</p>
          <SignInOptions />
        </div>
      )}

      <UpdateProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialName={myProfileQuery.data?.name ?? name ?? ''}
        initialPhone={myProfileQuery.data?.phoneNumber ?? ''}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['my-profile'] })
          navigate({ to: '/profile' })
        }}
      />
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </div>
  )
}

function ProfileRow({
  to,
  icon: Icon,
  label,
}: {
  to: '/loyalty' | '/sessions' | '/account'
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      to={to}
      className='hover:bg-accent flex items-center gap-3 p-4 font-medium transition-colors first:rounded-t-xl last:rounded-b-xl'
    >
      <Icon className='text-muted-foreground h-5 w-5' />
      <span className='flex-1'>{label}</span>
      <ChevronRight className='text-muted-foreground h-4 w-4 rtl:rotate-180' />
    </Link>
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
