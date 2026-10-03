import { useState } from 'react'
import { Languages, LogOut, SunMoon } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useLanguage, useT, type Language } from '@/lib/i18n'
import { useDirection } from '@/context/direction-provider'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EntityAvatar } from '@/components/entity-avatar'
import { SettingRow, SettingsCard } from '@/components/kit'
import { PageHeader } from '@/components/page-header'
import { SignOutDialog } from '@/components/sign-out-dialog'

/**
 * The signed-in person's own page: who they are, how the admin speaks and
 * looks for them, and the way out.
 */
export function SettingsProfile() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { setDir } = useDirection()
  const { theme, setTheme } = useTheme()
  const [signOutOpen, setSignOutOpen] = useState(false)

  const user = auth.user?.profile
  const name = user?.name || user?.preferred_username || t('adminUser')
  const email = user?.email || ''

  // Roles from the token, minus Keycloak's built-in noise
  const realmRoles =
    (auth.user?.profile?.realm_access as { roles?: string[] })?.roles || []
  const roles = [...new Set(realmRoles)].filter(
    (role) =>
      !role.startsWith('default-') &&
      !role.startsWith('uma_') &&
      role !== 'offline_access'
  )

  // The document's direction follows the language (Arabic → RTL)
  const pickLanguage = (next: Language) => {
    setLanguage(next)
    setDir(next === 'ar' ? 'rtl' : 'ltr')
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader title={t('profile')} description={t('profileSubtitle')} />

      {/* Who is signed in */}
      <SettingsCard title={t('account')}>
        <div className='flex items-center gap-4 px-5 py-4'>
          <EntityAvatar name={name} className='size-12 text-sm' />
          <div className='min-w-0'>
            <div className='truncate font-semibold'>{name}</div>
            {email && (
              <div className='text-muted-foreground truncate text-sm' dir='ltr'>
                {email}
              </div>
            )}
          </div>
        </div>
        {roles.length > 0 && (
          <SettingRow
            title={roles.length > 1 ? t('roles') : t('role')}
            control={
              <div className='flex flex-wrap gap-1.5'>
                {roles.map((role) => (
                  <Badge key={role} variant='secondary'>
                    {role === 'Admin'
                      ? t('adminRole')
                      : role === 'Owner'
                        ? t('owner')
                        : role}
                  </Badge>
                ))}
              </div>
            }
          />
        )}
      </SettingsCard>

      {/* How the admin speaks and looks, on this device */}
      <SettingsCard title={t('profilePreferences')}>
        <SettingRow
          icon={Languages}
          title={t('language')}
          control={
            <Select
              value={language}
              onValueChange={(v) => pickLanguage(v as Language)}
            >
              <SelectTrigger aria-label={t('language')} className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='en'>English</SelectItem>
                <SelectItem value='ar'>العربية</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          icon={SunMoon}
          title={t('theme')}
          control={
            <Select
              value={theme}
              onValueChange={(v) => setTheme(v as typeof theme)}
            >
              <SelectTrigger aria-label={t('selectTheme')} className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='light'>{t('light')}</SelectItem>
                <SelectItem value='dark'>{t('dark')}</SelectItem>
                <SelectItem value='system'>{t('systemDefault')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsCard>

      {/* The way out */}
      <SettingsCard>
        <SettingRow
          icon={LogOut}
          title={t('signOut')}
          description={t('profileSignOutHint')}
          control={
            <Button
              variant='outline'
              className='text-destructive hover:text-destructive'
              onClick={() => setSignOutOpen(true)}
            >
              {t('signOut')}
            </Button>
          }
        />
      </SettingsCard>

      {/* Version and environment as a caption, not a card's worth of info */}
      <p className='text-muted-foreground text-center text-xs'>
        {t('version', { version: __APP_VERSION__ })} ·{' '}
        {import.meta.env.DEV ? t('development') : t('production')}
      </p>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  )
}
