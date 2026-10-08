import {
  CalendarRange,
  Copy,
  Moon,
  PackageSearch,
  Percent,
  UtensilsCrossed,
  Sunrise,
  type LucideIcon,
} from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SettingsCard } from '@/components/kit'

/** The assistant's MCP prompts: Claude lists them under / and the + menu by these names. */
const ROUTINES: {
  prompt: string
  icon: LucideIcon
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
  {
    prompt: 'add_a_dish',
    icon: UtensilsCrossed,
    title: 'assistantRoutineDish',
    about: 'assistantRoutineDishAbout',
    ask: 'assistantRoutineDishAsk',
  },
  {
    prompt: 'menu_margins',
    icon: Percent,
    title: 'assistantRoutineMargins',
    about: 'assistantRoutineMarginsAbout',
    ask: 'assistantRoutineMarginsAsk',
  },
]

export function RoutinesCard() {
  const t = useT()
  const copyAsk = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('assistantRoutineCopied'))
  }

  return (
    <SettingsCard
      title={t('assistantRoutinesTitle')}
      description={t('assistantRoutinesHint')}
    >
      {/* No command name: each chat app names prompts its own way; they show by title */}
      <div className='grid gap-3 p-4 sm:grid-cols-2'>
        {ROUTINES.map(({ prompt, icon: Icon, title, about, ask }) => (
          <div
            key={prompt}
            className='bg-background flex flex-col gap-3 rounded-xl border p-4'
          >
            <div className='flex items-center gap-3'>
              <span className='bg-muted grid size-9 shrink-0 place-items-center rounded-lg'>
                <Icon className='text-muted-foreground size-4' />
              </span>
              <span className='min-w-0 flex-1 text-sm font-medium'>
                {t(title)}
              </span>
            </div>
            <p className='text-muted-foreground flex-1 text-sm'>{t(about)}</p>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='self-start'
              onClick={() => copyAsk(t(ask))}
            >
              <Copy />
              {t('assistantRoutineCopy')}
            </Button>
          </div>
        ))}
      </div>
      <p className='text-muted-foreground px-5 py-3 text-xs'>
        {t('assistantRoutinesBranch')}
      </p>
    </SettingsCard>
  )
}
