import { CalendarRange, Copy, Moon, PackageSearch, Sunrise } from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** The assistant's MCP prompts: Claude lists them under / and the + menu by these names. */
const ROUTINES: {
  prompt: string
  icon: React.ElementType
  title: TranslationKey
  about: TranslationKey
  ask: TranslationKey
}[] = [
  {
    prompt: 'morning_briefing',
    icon: Sunrise,
    title: 'assistantRoutineMorning',
    about: 'assistantRoutineMorningAbout',
    ask: 'assistantRoutineMorningAsk',
  },
  {
    prompt: 'close_the_day',
    icon: Moon,
    title: 'assistantRoutineClose',
    about: 'assistantRoutineCloseAbout',
    ask: 'assistantRoutineCloseAsk',
  },
  {
    prompt: 'weekly_review',
    icon: CalendarRange,
    title: 'assistantRoutineWeekly',
    about: 'assistantRoutineWeeklyAbout',
    ask: 'assistantRoutineWeeklyAsk',
  },
  {
    prompt: 'restock_check',
    icon: PackageSearch,
    title: 'assistantRoutineRestock',
    about: 'assistantRoutineRestockAbout',
    ask: 'assistantRoutineRestockAsk',
  },
]

export function RoutinesCard() {
  const t = useT()
  const copyAsk = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('assistantRoutineCopied'))
  }

  return (
    <Card>
      <CardContent className='space-y-4 pt-6'>
        <div className='space-y-1'>
          <h2 className='font-semibold'>{t('assistantRoutinesTitle')}</h2>
          <p className='text-muted-foreground text-sm'>{t('assistantRoutinesHint')}</p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          {ROUTINES.map(({ prompt, icon: Icon, title, about, ask }) => (
            <div key={prompt} className='flex flex-col gap-3 rounded-lg border p-4'>
              <div className='flex items-start gap-3'>
                <div className='bg-muted grid size-9 shrink-0 place-items-center rounded-lg'>
                  <Icon className='size-4' />
                </div>
                <div className='min-w-0 space-y-1'>
                  <h3 className='text-sm font-medium'>{t(title)}</h3>
                  <p className='text-muted-foreground text-xs leading-relaxed'>{t(about)}</p>
                </div>
              </div>
              {/* No command name: each chat app names prompts its own way; they show by title */}
              <div className='mt-auto flex items-center justify-end gap-2'>
                <Button type='button' size='sm' variant='outline' onClick={() => copyAsk(t(ask))}>
                  <Copy className='size-4' />
                  {t('assistantRoutineCopy')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className='text-muted-foreground text-xs'>{t('assistantRoutinesBranch')}</p>
      </CardContent>
    </Card>
  )
}
