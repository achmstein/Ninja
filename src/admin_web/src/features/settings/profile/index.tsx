import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Info, LogOut } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
export function SettingsProfile() {
  const t = useT()
  const auth = useAuth()
  const [signOutOpen, setSignOutOpen] = useState(false)

  // Extract user info from OIDC
  const user = auth.user?.profile
  const name = user?.name || user?.preferred_username || t('adminUser')
  const email = user?.email || ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Extract roles from token
  const realmRoles = (auth.user?.profile?.realm_access as { roles?: string[] })?.roles || []
  const resourceRoles = (auth.user?.profile?.resource_access as Record<string, { roles?: string[] }>) || {}
  const clientRoles = resourceRoles['chillax-admin']?.roles || []
  const roles = [...new Set([...realmRoles, ...clientRoles])].filter(
    (role) => !role.startsWith('default-') && !role.startsWith('uma_') && role !== 'offline_access'
  )

  const handleSignOut = () => {
    auth.signoutRedirect()
  }

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>{t('profile')}</h3>
        <p className='text-sm text-muted-foreground'>{t('profileSubtitle')}</p>
      </div>

      <Separator />

      {/* Profile Card */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-start gap-6'>
            <Avatar className='h-20 w-20'>
              <AvatarFallback className='text-2xl'>{initials}</AvatarFallback>
            </Avatar>
            <div className='flex-1 space-y-2'>
              <div>
                <h4 className='text-xl font-semibold'>{name}</h4>
                {email && (
                  <p className='text-sm text-muted-foreground'>{email}</p>
                )}
              </div>
              {roles.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant={role.toLowerCase() === 'admin' ? 'default' : 'secondary'}
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
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <div className='space-y-4'>
        <h4 className='text-lg font-medium'>{t('about')}</h4>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-sm font-medium'>
              <Info className='h-4 w-4' />
              {t('applicationInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-0'>
            <div className='flex items-center justify-between py-3 border-b'>
              <span className='text-sm font-medium'>{t('appVersion')}</span>
              <span className='text-sm text-muted-foreground'>1.0.0</span>
            </div>
            <div className='flex items-center justify-between py-3'>
              <span className='text-sm font-medium'>{t('environment')}</span>
              <Badge variant='outline'>
                {import.meta.env.DEV ? t('development') : t('production')}
              </Badge>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Sign Out */}
      <div className='pt-4'>
        <Button
          variant='destructive'
          className='w-full'
          onClick={() => setSignOutOpen(true)}
        >
          <LogOut className='me-2 h-4 w-4' />
          {t('signOut')}
        </Button>
      </div>

      {/* Sign Out Confirmation */}
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
