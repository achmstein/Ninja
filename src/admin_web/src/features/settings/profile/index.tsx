import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { LogOut } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** One plain block, no cards: centered identity, sign out, version caption. */
export function SettingsProfile() {
  const t = useT()
  const auth = useAuth()
  const [signOutOpen, setSignOutOpen] = useState(false)

  const user = auth.user?.profile
  const name = user?.name || user?.preferred_username || t('adminUser')
  const email = user?.email || ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Roles from the token, minus Keycloak's built-in noise
  const realmRoles =
    (auth.user?.profile?.realm_access as { roles?: string[] })?.roles || []
  const resourceRoles =
    (auth.user?.profile?.resource_access as Record<
      string,
      { roles?: string[] }
    >) || {}
  const clientRoles = resourceRoles['chillax-admin']?.roles || []
  const roles = [...new Set([...realmRoles, ...clientRoles])].filter(
    (role) =>
      !role.startsWith('default-') &&
      !role.startsWith('uma_') &&
      role !== 'offline_access'
  )

  const handleSignOut = () => {
    auth.signoutRedirect()
  }

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>{t('profile')}</h3>
        <p className='text-muted-foreground text-sm'>{t('profileSubtitle')}</p>
      </div>

      <Separator />

      {/* Identity — plain and centered, no card */}
      <div className='flex flex-col items-center gap-1 pt-4 text-center'>
        <Avatar className='h-20 w-20'>
          <AvatarFallback className='text-2xl'>{initials}</AvatarFallback>
        </Avatar>
        <div className='pt-3 text-xl font-bold'>{name}</div>
        {email && (
          <div className='text-muted-foreground text-sm'>{email}</div>
        )}
        {roles.length > 0 && (
          <div className='flex flex-wrap justify-center gap-2 pt-2'>
            {roles.map((role) => (
              <Badge
                key={role}
                variant={
                  role.toLowerCase() === 'admin' ? 'default' : 'secondary'
                }
              >
                {role === 'Admin'
                  ? t('adminRole')
                  : role === 'Owner'
                    ? t('owner')
                    : role}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button
        variant='destructive'
        className='w-full'
        onClick={() => setSignOutOpen(true)}
      >
        <LogOut className='me-2 h-4 w-4' />
        {t('signOut')}
      </Button>

      {/* Version + environment as a caption — not a card's worth of info */}
      <p className='text-muted-foreground text-center text-xs'>
        {t('version', { version: __APP_VERSION__ })} ·{' '}
        {import.meta.env.DEV ? t('development') : t('production')}
      </p>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('signOutQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('signOutConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              {t('signOut')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
