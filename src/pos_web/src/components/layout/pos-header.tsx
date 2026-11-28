import { useState } from 'react'
import { loginPageParams } from '@/config/oidc-config'
import { KeyRound, Languages, LogOut, Moon, Printer, Settings, Sun, Users } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useLanguage, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'
import { useCallCentre } from '@/hooks/use-call-centre'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BranchSwitcher } from '@/components/layout/branch-switcher'
import { TradingChip } from '@/features/branch/trading-chip'
import { useKeepCashierRoster } from '@/features/cashiers/use-keep-cashier-roster'
import { OfflineChip } from '@/features/offline/offline-chip'
import { PrintSettingsDialog } from '@/features/printing/print-settings-dialog'
import { SendingChip } from '@/features/sending/sending-chip'
import { ShiftChip } from '@/features/shift/shift-chip'

/**
 * The single app-chrome row: brand + branch on the start side, drawer shift
 * status on the end side. Language, theme and sign-out are a shift's worth
 * of taps apart in practice, so they live behind the settings menu instead
 * of spending header width all day. All targets ≥ 48px for gloved, hurried
 * fingers — menu rows included.
 *
 * The menu opens on who is selling, since a till changes hands: Switch
 * cashier signs them out to the screen of names (routes/(auth)/signed-out),
 * where the next one taps theirs and types their PIN; Set my PIN is where
 * they choose it, on Keycloak's page, after their password.
 */
export function PosHeader() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  // The call centre keeps no drawer: the branch's rider or counter takes the cash
  const callCentre = useCallCentre().on
  const [printingOpen, setPrintingOpen] = useState(false)
  // The names the signed-out screen offers, kept current while someone is here
  useKeepCashierRoster()
  const cashierName = auth.user?.profile.name || auth.user?.profile.given_name || auth.user?.profile.preferred_username

  const setMyPin = () => {
    sessionStorage.setItem('auth_redirect', window.location.pathname)
    const page = loginPageParams(resolvedTheme, language)
    void auth.signinRedirect({
      extraQueryParams: { ...page.extraQueryParams, kc_action: 'ninja-configure-pin' },
    })
  }

  return (
    <header className='bg-background sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3 max-sm:px-2'>
      <BranchSwitcher />
      <div className='ms-auto flex shrink-0 items-center gap-1'>
        <SendingChip />
        <OfflineChip />
        {/* Whether customers can order and reserve, and the switches for it */}
        {!callCentre && <TradingChip />}
        {!callCentre && <ShiftChip />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-12'>
              <Settings className='size-5' />
              <span className='sr-only'>{t('settings')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='min-w-56 rounded-lg'>
            {cashierName && (
              <>
                <DropdownMenuLabel className='truncate p-3 text-base'>{cashierName}</DropdownMenuLabel>
                <DropdownMenuItem className='min-h-12 gap-2 p-3 text-base' onSelect={() => auth.signoutRedirect()}>
                  <Users className='size-5' />
                  {t('switchCashier')}
                </DropdownMenuItem>
                <DropdownMenuItem className='min-h-12 gap-2 p-3 text-base' onSelect={setMyPin}>
                  <KeyRound className='size-5' />
                  {t('setMyPin')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {/* Two languages, two themes: each row states where it stands
                and flips on tap — no submenu to chase on a touchscreen */}
            <DropdownMenuItem
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            >
              <Languages className='size-5' />
              <span className='flex-1'>{t('language')}</span>
              <span className='text-muted-foreground'>{language === 'ar' ? 'العربية' : 'English'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Moon className='size-5' /> : <Sun className='size-5' />}
              <span className='flex-1'>{t('theme')}</span>
              <span className='text-muted-foreground'>
                {resolvedTheme === 'dark' ? t('themeDark') : t('themeLight')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className='min-h-12 gap-2 p-3 text-base' onSelect={() => setPrintingOpen(true)}>
              <Printer className='size-5' />
              <span className='flex-1'>{t('printingSettings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant='destructive'
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() => auth.signoutRedirect()}
            >
              <LogOut className='size-5' />
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PrintSettingsDialog open={printingOpen} onOpenChange={setPrintingOpen} />
      </div>
    </header>
  )
}
