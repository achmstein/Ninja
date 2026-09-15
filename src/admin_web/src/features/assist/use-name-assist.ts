import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import {
  type AssistSlot,
  type Lang,
  type LocalizedValue,
  useDefaultLang,
} from '@/components/localized-input'
import { halfFilled, hasText } from './helpers'
import { localizeBlocker, useLocalizeAssist } from './use-localize-assist'

/**
 * The assistant on a form that is just a bilingual name (a category, a
 * stock item): everything a `LocalizedInput` needs to show the sparkle,
 * tint what came back, and flip to that language. The item form does the
 * same by hand because it also carries a description and a category.
 */
export function useNameAssist(
  kind: number,
  name: LocalizedValue,
  setName: (update: (prev: LocalizedValue) => LocalizedValue) => void
) {
  const t = useT()
  const assist = useLocalizeAssist()
  const [lang, setLang] = useState<Lang>(useDefaultLang())
  const [suggested, setSuggested] = useState<Partial<Record<Lang, boolean>>>({})
  const blocker = localizeBlocker(name)

  const ask = async () => {
    const source = halfFilled(name)
    if (!source) return
    const target: Lang = source === 'en' ? 'ar' : 'en'
    try {
      const result = await assist.localize({ kind, name })
      const filled = result.filled.includes(`name.${target}`)
      if (filled) {
        setName((prev) =>
          hasText(prev[target])
            ? prev
            : { ...prev, [target]: result.name[target] ?? '' }
        )
        setSuggested({ [target]: true })
        setLang(target)
      }
      for (const warning of result.warnings) toast.warning(warning)
    } catch {
      // toasted by the hook
    }
  }

  const slot: AssistSlot | undefined = assist.available
    ? {
        onClick: ask,
        pending: assist.isPending,
        disabled: !!blocker,
        label: blocker ? t(blocker) : t('assistFillOtherLanguage'),
      }
    : undefined

  /** Wrap the field's onChange with this so an edit clears the tint */
  const onChange = (value: LocalizedValue, typed: Lang) => {
    setName(() => value)
    setSuggested((prev) => ({ ...prev, [typed]: false }))
  }

  return { slot, suggested, lang, setLang, onChange }
}
