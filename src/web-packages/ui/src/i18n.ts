import { createI18n } from '@ninja/web-core/i18n'

/** The few words the shared components say, in the app's own language */
const dictionary = {
  poweredBy: { en: 'Powered by', ar: 'بدعم من' },
}

export const { useT } = createI18n(dictionary)
