import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Languages, LogOut, Moon, Printer, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BranchSwitcher } from '@/components/layout/branch-switcher'
import { OfflineChip } from '@/features/offline/offline-chip'
import { PrintSettingsDialog } from '@/features/printing/print-settings-dialog'
import { SendingChip } from '@/features/sending/sending-chip'
import { ShiftChip } from '@/features/shift/shift-chip'
import { useCallCentre } from '@/hooks/use-call-centre'
import { useLanguage, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'

/**
 * The single app-chrome row: brand + branch on the start side, drawer shift
 * status on the end side. Language, theme and sign-out are a shift's worth
 * of taps apart in practice, so they live behind the settings menu instead
 * of spending header width all day. All targets ≥ 48px for gloved, hurried
 * fingers — menu rows included.
 */
export function PosHeader() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  // The call centre keeps no drawer: the branch's rider or counter takes the cash
  const callCentre = useCallCentre().on
  const [printingOpen, setPrintingOpen] = useState(false)

  return (
    <header className='bg-background sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3 max-sm:px-2'>
      <BranchSwitcher />
      <div className='ms-auto flex shrink-0 items-center gap-1'>
        <SendingChip />
        <OfflineChip />
        {!callCentre && <ShiftChip />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-12'>
              <Settings className='size-5' />
              <span className='sr-only'>{t('settings')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='min-w-56 rounded-lg'>
            {/* Two languages, two themes: each row states where it stands
                and flips on tap — no submenu to chase on a touchscreen */}
            <DropdownMenuItem
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            >
              <Languages className='size-5' />
              <span className='flex-1'>{t('language')}</span>
              <span className='text-muted-foreground'>
                {language === 'ar' ? 'العربية' : 'English'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
            >
              {resolvedTheme === 'dark' ? (
                <Moon className='size-5' />
              ) : (
                <Sun className='size-5' />
              )}
              <span className='flex-1'>{t('theme')}</span>
              <span className='text-muted-foreground'>
                {resolvedTheme === 'dark' ? t('themeDark') : t('themeLight')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='min-h-12 gap-2 p-3 text-base'
              onSelect={() => setPrintingOpen(true)}
            >
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
