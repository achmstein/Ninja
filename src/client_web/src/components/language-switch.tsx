import { Check, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const t = useT()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='scale-95 rounded-full'>
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>{t('language')}</span>
        </Button>
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
