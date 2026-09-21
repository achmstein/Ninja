import { Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Languages, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wordmark } from '@/components/wordmark'
import { useLanguage, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'

/**
 * The single app-chrome row: the mark on the start side, the settings menu
 * (language, theme, sign-out) on the end side.
 */
export function AppHeader() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className='bg-background sticky top-0 z-40 border-b'>
      <div className='mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4'>
        <Link to='/' className='flex items-center'>
          <Wordmark />
        </Link>
        <div className='ms-auto flex items-center gap-1'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='size-9'>
                <Settings className='size-4' />
                <span className='sr-only'>{t('settings')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-48 rounded-lg'>
              <DropdownMenuItem
                onSelect={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              >
                <Languages className='size-4' />
                <span className='flex-1'>{t('language')}</span>
                <span className='text-muted-foreground'>
                  {language === 'ar' ? 'العربية' : 'English'}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                }
              >
                {resolvedTheme === 'dark' ? (
                  <Moon className='size-4' />
                ) : (
                  <Sun className='size-4' />
                )}
                <span className='flex-1'>{t('theme')}</span>
                <span className='text-muted-foreground'>
                  {resolvedTheme === 'dark' ? t('themeDark') : t('themeLight')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onSelect={() => auth.signoutRedirect()}
              >
                <LogOut className='size-4' />
                {t('signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
