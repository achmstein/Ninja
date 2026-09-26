import { Languages } from 'lucide-react'
import { useLanguage, useT } from '@/lib/i18n'
import { TileRow } from '@/components/tile-row'
import { Segment } from '@/components/ninja/page/parts'

/** The language row on the settings page: both languages in one track, each named in itself. */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const t = useT()
  return (
    <TileRow
      icon={Languages}
      label={t('language')}
      trailing={
        <Segment
          compact
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية' },
          ]}
        />
      }
    />
  )
}
