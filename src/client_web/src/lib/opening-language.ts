/**
 * Which languages a business writes its own text in (its menu, places, names):
 * both, or one of them only. A one-language business's app speaks that
 * language and offers no switch; the rest open in the business's default until
 * the customer picks one.
 */
export type ContentLanguages = 'both' | 'ar' | 'en'

type Language = 'ar' | 'en'

/** The brand's value as the app reads it: anything unknown (an older stack sends none) is both. */
export function contentLanguagesOf(value: string | null | undefined): ContentLanguages {
  return value === 'ar' || value === 'en' ? value : 'both'
}

/**
 * The language the app shows: the control panel's preview asks for one
 * explicitly; a one-language business's only language; the customer's own
 * choice; the business's default; Arabic.
 */
export function openingLanguage({
  contentLanguages,
  businessDefault,
  chosen,
  previewLanguage,
}: {
  contentLanguages: string | null | undefined
  businessDefault: string | null | undefined
  /** The language the customer picked on the settings page, if they did */
  chosen: Language | null
  previewLanguage?: Language
}): Language {
  if (previewLanguage) return previewLanguage
  const languages = contentLanguagesOf(contentLanguages)
  if (languages !== 'both') return languages
  if (chosen) return chosen
  return businessDefault === 'en' ? 'en' : 'ar'
}
