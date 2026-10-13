import { type TranslationKey } from '@/lib/i18n'
import { type ChipTone } from '@/components/status-chip'
import { type MenuClass } from './menu-engineering-rows'

/** Each class's colour: a star is good news, a dog bad */
export const CLASS_TONE: Record<MenuClass, ChipTone> = {
  star: 'success',
  plowhorse: 'info',
  puzzle: 'warning',
  dog: 'danger',
}

export const CLASS_LABEL: Record<MenuClass, TranslationKey> = {
  star: 'menuClassStar',
  plowhorse: 'menuClassPlowhorse',
  puzzle: 'menuClassPuzzle',
  dog: 'menuClassDog',
}

/** Ninja's moves as the owner reads them */
export const ADVICE_LABEL: Record<string, TranslationKey> = {
  'raise-price': 'adviceRaisePrice',
  'lower-price': 'adviceLowerPrice',
  promote: 'advicePromote',
  rework: 'adviceRework',
  remove: 'adviceRemove',
  keep: 'adviceKeep',
}
