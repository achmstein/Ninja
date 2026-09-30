import { createContext, useContext } from 'react'

/**
 * Which languages the business writes its own text in (menu, places,
 * stock): both, or one only. The root provides it from the brand; a form
 * field reads it here without pulling in the API client, so modules that
 * only shape form state stay importable anywhere (tests included).
 */
export type ContentLanguages = 'both' | 'ar' | 'en'

export function contentLanguagesOf(
  value: string | null | undefined
): ContentLanguages {
  return value === 'ar' || value === 'en' ? value : 'both'
}

/** "both" until the brand has loaded, and outside the app (tests, previews) */
export const ContentLanguagesContext = createContext<ContentLanguages>('both')

export function useContentLanguages(): ContentLanguages {
  return useContext(ContentLanguagesContext)
}
