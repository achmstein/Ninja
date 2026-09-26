import { Monitor, Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { useT } from '@/lib/i18n'
import { TileRow } from '@/components/tile-row'
import { Segment } from '@/components/ninja/page/parts'

/** The theme row on the settings page: the three choices in one track, the pill sliding to the one picked. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  return (
    <TileRow
      icon={SunMoon}
      label={t('theme')}
      trailing={
        <Segment
          compact
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: <Sun className='size-4' />, ariaLabel: t('light') },
            { value: 'dark', label: <Moon className='size-4' />, ariaLabel: t('dark') },
            { value: 'system', label: <Monitor className='size-4' />, ariaLabel: t('systemDefault') },
          ]}
        />
      }
    />
  )
}
