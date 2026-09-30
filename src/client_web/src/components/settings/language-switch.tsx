import { Languages } from 'lucide-react'
import { useBrand } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { contentLanguagesOf } from '@/lib/opening-language'
import { TileRow } from '@/components/ninja/page/tile-row'
import { Segment } from '@/components/ninja/page/parts'

/**
 * The language row on the settings page: both languages in one track, each
 * named in itself. None for a business that writes one language: the app speaks it.
 */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const t = useT()
  const brand = useBrand()
  if (contentLanguagesOf(brand?.locale?.contentLanguages) !== 'both') return null
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
