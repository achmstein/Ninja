import { Check, Languages } from 'lucide-react'
import { useLanguage, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useDirection } from '@/context/direction-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Language picker; keeps the document direction in sync (Arabic → RTL). */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const { setDir } = useDirection()

  const pick = (next: Language) => {
    setLanguage(next)
    setDir(next === 'ar' ? 'rtl' : 'ltr')
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='scale-95 rounded-full'>
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => pick('en')}>
          English
          <Check
            size={14}
            className={cn('ms-auto', language !== 'en' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => pick('ar')}>
          العربية
          <Check
            size={14}
            className={cn('ms-auto', language !== 'ar' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
