import { createContext, useContext, useId, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { type LocalizedText } from '@/api/catalog'
import { useContentLanguages } from '@/lib/content-languages'
import { useLanguage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type Lang = 'en' | 'ar'

/** Both languages as plain strings, the shape a form keeps in state */
export type LocalizedValue = { en: string; ar: string }

/** From the API's nullable pair to form state */
export function toLocalizedValue(
  text: LocalizedText | null | undefined
): LocalizedValue {
  return { en: text?.en ?? '', ar: text?.ar ?? '' }
}

/**
 * Back to the API's shape: trimmed, an empty side becomes null. A business
 * may write in one language only, so either side may be the one missing.
 */
export function fromLocalizedValue(value: LocalizedValue): {
  en: string | null
  ar: string | null
} {
  return { en: value.en.trim() || null, ar: value.ar.trim() || null }
}

/**
 * Whichever language is written, English first: for keys, prompts and
 * matching outside a component (a component reads with useLocalized).
 */
export function primaryText(text: LocalizedText | null | undefined): string {
  return text?.en?.trim() || text?.ar?.trim() || ''
}

const ARABIC_LETTER =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/**
 * A text whose language nobody said (a line read off a receipt): Arabic
 * script goes to the Arabic side, anything else to the English one.
 */
export function inScriptOf(text: string): LocalizedValue {
  return ARABIC_LETTER.test(text) ? { en: '', ar: text } : { en: text, ar: '' }
}

/** Neither language is written: what a required name refuses */
export function isBlank(value: LocalizedValue): boolean {
  return value.en.trim() === '' && value.ar.trim() === ''
}

const LangContext = createContext<{
  lang: Lang
  setLang: (lang: Lang) => void
} | null>(null)

/**
 * The business's only language when it writes its text in one, null when it
 * writes both: its fields then ask for that language alone, with no switch
 */
export function useOnlyLang(): Lang | null {
  const languages = useContentLanguages()
  return languages === 'both' ? null : languages
}

/**
 * The language a localized field starts in: the business's only one, else the
 * one the UI is in, so an Arabic-speaking admin types Arabic first and an
 * English-speaking one English. Read once, when the field or form mounts.
 */
export function useDefaultLang(): Lang {
  const only = useOnlyLang()
  const ui = useLanguage((s) => s.language)
  return only ?? ui
}

/**
 * Wrap a form in this so every localized field on it switches language
 * together: pick Arabic once, fill in all the Arabic names, done. Starts
 * in the UI's language unless `defaultLang` says otherwise.
 */
export function LocalizedFields({
  defaultLang,
  lang: controlled,
  onLangChange,
  children,
}: {
  defaultLang?: Lang
  /** Drive the language from outside (a form that flips to what was just filled in) */
  lang?: Lang
  onLangChange?: (lang: Lang) => void
  children: React.ReactNode
}) {
  const only = useOnlyLang()
  const uiLang = useDefaultLang()
  const [own, setOwn] = useState<Lang>(defaultLang ?? uiLang)
  const lang = only ?? controlled ?? own
  const setLang = (next: Lang) => {
    setOwn(next)
    onLangChange?.(next)
  }
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

function useLang(): [Lang, (lang: Lang) => void] {
  const shared = useContext(LangContext)
  const only = useOnlyLang()
  const uiLang = useDefaultLang()
  const [local, setLocal] = useState<Lang>(uiLang)
  if (only) return [only, setLocal]
  return shared ? [shared.lang, shared.setLang] : [local, setLocal]
}

/** The assistant's button at the end of the field */
export type AssistSlot = {
  onClick: () => void
  pending?: boolean
  disabled?: boolean
  /** Tooltip and accessible name; also the reason when disabled */
  label: string
}

type LocalizedInputProps = {
  /** Visible label; give `ariaLabel` instead inside a labelled grid */
  label?: React.ReactNode
  ariaLabel?: string
  value: LocalizedValue
  /** The whole value, plus which language was just typed */
  onChange: (value: LocalizedValue, lang: Lang) => void
  /** Sparkle button before the language switch */
  assist?: AssistSlot
  /** Languages the assistant filled in and the user has not touched yet */
  suggested?: Partial<Record<Lang, boolean>>
  id?: string
  /** A textarea instead of a single line */
  multiline?: boolean
  rows?: number
  placeholder?: Partial<Record<Lang, string>>
  /** Shown under the field and marks it invalid */
  error?: string
  autoFocus?: boolean
  /** Not editable yet (a pack name before there is a pack size); the switch still turns */
  disabled?: boolean
  /** The h-8 size used inside dense editors */
  compact?: boolean
  className?: string
}

/**
 * One field for a bilingual text. The switch at its end picks which
 * language is being typed; the other language's item shows a dot while it
 * is still empty, so nothing gets published half-translated by accident.
 * A business that writes one language gets a plain field in that language.
 * With `assist`, a sparkle button asks the assistant to fill in the other
 * language; what it filled shows tinted until the user edits it.
 */
export function LocalizedInput({
  label,
  ariaLabel,
  value,
  onChange,
  assist,
  suggested,
  id,
  multiline,
  rows = 2,
  placeholder,
  error,
  autoFocus,
  disabled,
  compact,
  className,
}: LocalizedInputProps) {
  const t = useT()
  const generated = useId()
  const fieldId = id ?? generated
  const [lang, setLang] = useLang()
  const only = useOnlyLang()

  const control = {
    id: fieldId,
    value: value[lang],
    dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
    placeholder: placeholder?.[lang],
    'aria-label': label ? undefined : ariaLabel,
    autoFocus,
    disabled,
    'aria-invalid': !!error || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [lang]: e.target.value }, lang),
  }
  const isSuggested = !!suggested?.[lang]

  const languageSwitch = only ? null : (
    <ToggleGroup
      type='single'
      size='sm'
      value={lang}
      onValueChange={(next) => next && setLang(next as Lang)}
      aria-label={t('language')}
      className={compact ? 'h-6' : 'h-7'}
    >
      <LangItem
        lang='en'
        filled={value.en.trim() !== ''}
        suggested={!!suggested?.en}
      />
      <LangItem
        lang='ar'
        filled={value.ar.trim() !== ''}
        suggested={!!suggested?.ar}
      />
    </ToggleGroup>
  )

  const assistButton = assist && (
    <InputGroupButton
      aria-label={assist.label}
      title={assist.label}
      disabled={assist.disabled || assist.pending}
      onClick={assist.onClick}
      className='text-primary'
    >
      {assist.pending ? <Spinner /> : <Sparkles />}
    </InputGroupButton>
  )

  return (
    <div className={cn(label && 'space-y-2', className)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <InputGroup
        className={cn(compact && 'h-8', isSuggested && 'bg-primary/5')}
      >
        {multiline ? (
          <>
            <InputGroupTextarea rows={rows} {...control} />
            <InputGroupAddon align='block-end' className='justify-end'>
              {assistButton}
              {languageSwitch}
            </InputGroupAddon>
          </>
        ) : (
          <>
            <InputGroupInput className={cn(compact && 'h-8')} {...control} />
            <InputGroupAddon align='inline-end'>
              {assistButton}
              {languageSwitch}
            </InputGroupAddon>
          </>
        )}
      </InputGroup>
      {isSuggested && !error && (
        <p className='text-primary flex items-center gap-1 text-xs'>
          <Sparkles className='size-3' aria-hidden />
          {t('assistSuggested')}
        </p>
      )}
      {error && <p className='text-destructive text-sm'>{error}</p>}
    </div>
  )
}

function LangItem({
  lang,
  filled,
  suggested,
}: {
  lang: Lang
  filled: boolean
  suggested: boolean
}) {
  const t = useT()
  return (
    <ToggleGroupItem
      value={lang}
      className='h-full min-w-0 gap-1 px-2 text-xs font-semibold'
      aria-label={lang === 'en' ? t('english') : t('arabic')}
    >
      {lang === 'en' ? 'EN' : 'ع'}
      {suggested ? (
        <Sparkles className='text-primary size-3' aria-hidden />
      ) : (
        !filled && (
          <span
            className='bg-warning size-1.5 rounded-full'
            aria-hidden
            title={lang === 'en' ? t('english') : t('arabic')}
          />
        )
      )}
    </ToggleGroupItem>
  )
}
