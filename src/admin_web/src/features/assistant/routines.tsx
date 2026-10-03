import {
  CalendarRange,
  Copy,
  Moon,
  PackageSearch,
  Sunrise,
  type LucideIcon,
} from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SettingRow, SettingsCard } from '@/components/kit'

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
      {ROUTINES.map(({ prompt, icon, title, about, ask }) => (
        <SettingRow
          key={prompt}
          icon={icon}
          title={t(title)}
          description={t(about)}
          control={
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => copyAsk(t(ask))}
            >
              <Copy />
              {t('assistantRoutineCopy')}
            </Button>
          }
        />
      ))}
      <p className='text-muted-foreground px-5 py-3 text-xs'>
        {t('assistantRoutinesBranch')}
      </p>
    </SettingsCard>
  )
}
