import { useAuth } from 'react-oidc-context'
import {
  Download,
  Languages,
  LogOut,
  Maximize,
  Minimize,
  Moon,
  Settings,
  Sun,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BranchSwitcher } from '@/components/layout/branch-switcher'
import { HistoryDialog } from '@/features/board/history-dialog'
import { useSoundUnlock } from '@/features/board/use-sound-unlock'
import { useFullscreen } from '@/hooks/use-fullscreen'
import { useLanguage, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { useTheme } from '@/context/theme-provider'

/**
 * The single app-chrome row: brand + branch on the start side; the day's
 * history, full screen and the settings menu on the end side. Language,
 * theme, install and sign-out are set once per screen in practice, so they
 * live behind the menu instead of spending header width all day. All
 * targets ≥ 48px for wet, hurried fingers — menu rows included.
 */
export function KitchenHeader() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  const fullscreen = useFullscreen()
  const installPrompt = useInstallPrompt()
  const soundUnlocked = useSoundUnlock()

  // Chromium: the native prompt. iPad: no prompt exists, only the hint.
  // Installed already, or a browser that offers neither: nothing to show.
  const showInstall =
    installPrompt.canInstall ||
    (installPrompt.isIos && !installPrompt.isStandalone)

  const handleInstall = () => {
    if (installPrompt.canInstall) {
      installPrompt.install()
    } else {
      toast.info(t('installIosHint'))
    }
  }

  return (
    <header className='bg-background sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3'>
      <BranchSwitcher />
      <div className='ms-auto flex items-center gap-1'>
        {/* Browsers keep audio muted until a tap; the crossed speaker is
            that tap, and it leaves once sound is unlocked */}
        {!soundUnlocked && (
          <Button variant='ghost' size='icon' className='size-12 text-amber-600 dark:text-amber-400'>
            <VolumeX className='size-5' />
            <span className='sr-only'>{t('soundBanner')}</span>
          </Button>
        )}
        <HistoryDialog />
        {fullscreen.supported && (
          <Button
            variant='ghost'
            size='icon'
            className='size-12'
            onClick={fullscreen.toggle}
          >
            {fullscreen.isFullscreen ? (
              <Minimize className='size-5' />
            ) : (
              <Maximize className='size-5' />
            )}
            <span className='sr-only'>
              {fullscreen.isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            </span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-12'>
              <Settings className='size-5' />
              <span className='sr-only'>{t('settings')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='min-w-56 rounded-lg'>
            {showInstall && (
              <>
                <DropdownMenuItem
                  className='min-h-12 gap-2 p-3 text-base'
                  onSelect={handleInstall}
                >
                  <Download className='size-5' />
                  <span className='flex-1'>{t('installApp')}</span>
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
      </div>
    </header>
  )
}
