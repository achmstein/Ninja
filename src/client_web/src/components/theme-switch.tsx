import { Check, SunMoon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { useT, type TranslationKey } from '@/lib/i18n'
import { TileButton } from '@/components/tile-row'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themeLabel: Record<string, TranslationKey> = {
  light: 'light',
  dark: 'dark',
  system: 'systemDefault',
}

/** The theme row on the settings page: a tile like its neighbours, the
 *  current choice before the chevron, the choices in a menu. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const t = useT()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TileButton
          icon={SunMoon}
          label={t('theme')}
          value={t(themeLabel[theme] ?? 'systemDefault')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          {t('light')}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          {t('dark')}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'dark' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          {t('systemDefault')}
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'system' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
