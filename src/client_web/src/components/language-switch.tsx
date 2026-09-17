import { Check, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage, useT } from '@/lib/i18n'
import { TileButton } from '@/components/tile-row'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** The language row on the settings page: a tile like its neighbours, the
 *  current language before the chevron, both languages in a menu. */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const t = useT()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TileButton
          icon={Languages}
          label={t('language')}
          value={language === 'ar' ? 'العربية' : 'English'}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => setLanguage('ar')}>
          العربية
          <Check
            size={14}
            className={cn('ms-auto', language !== 'ar' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('en')}>
          English
          <Check
            size={14}
            className={cn('ms-auto', language !== 'en' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
