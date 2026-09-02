import { useAuth } from 'react-oidc-context'
import { Languages, LogOut, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BranchSwitcher } from '@/components/layout/branch-switcher'
import { ShiftChip } from '@/features/shift/shift-chip'
import { useLanguage, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'

/**
 * The single app-chrome row: brand + branch on the start side; drawer
 * shift status, language, theme, and sign-out on the end side. All targets
 * ≥ 48px for gloved, hurried fingers.
 */
export function PosHeader() {
  const t = useT()
  const auth = useAuth()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className='bg-background sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3'>
      <BranchSwitcher />
      <div className='ms-auto flex items-center gap-1'>
        <ShiftChip />
        <Button
          variant='ghost'
          className='h-12 gap-2 px-3'
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        >
          <Languages className='size-5' />
          <span className='text-sm font-medium'>
            {language === 'ar' ? 'English' : 'العربية'}
          </span>
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-12'
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className='size-5' />
          ) : (
            <Moon className='size-5' />
          )}
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-12'
          aria-label={t('signOut')}
          onClick={() => auth.signoutRedirect()}
        >
          <LogOut className='size-5' />
        </Button>
      </div>
    </header>
  )
}
