import { createContext, useContext, useId, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useContentLanguages } from '@/lib/content-languages'
import { useLanguage, useT } from '@/lib/i18n'
import { type Lang, type LocalizedValue } from '@/lib/localized-value'
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
import {
  localizedFields,
  mergeLocalized,
  useFormFill,
} from '@/features/assist/use-form-fill'

// The pure helpers live with the value's type, so logic that only shapes
// text needs no component; re-exported here for the forms
export {
  fromLocalizedValue,
  inScriptOf,
  isBlank,
  primaryText,
  toLocalizedValue,
  type Lang,
  type LocalizedValue,
} from '@/lib/localized-value'

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
  /**
   * Sparkle button before the language switch. Left out, the field offers
   * its own while one language is typed and the other is empty: the
   * assistant writes the other side. `false` turns that off.
   */
  assist?: AssistSlot | false
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

  // The field's own assistant: the other language of what is typed
  const formFill = useFormFill()
  const [ownSuggested, setOwnSuggested] = useState<
    Partial<Record<Lang, boolean>>
  >({})
  const hasEn = value.en.trim() !== ''
  const hasAr = value.ar.trim() !== ''
  const missing: Lang | null =
    hasEn && !hasAr ? 'ar' : hasAr && !hasEn ? 'en' : null
  const named =
    typeof label === 'string' ? label : (ariaLabel ?? t('assistOtherLanguage'))
  const ownAssist: AssistSlot | undefined =
    assist === undefined && !only && !disabled && missing && formFill.available
      ? {
          label: t('assistOtherLanguage'),
          pending: formFill.isPending,
          onClick: async () => {
            try {
              const filled = await formFill.fill(
                named,
                localizedFields('text', named, value, multiline)
              )
              const merged = mergeLocalized('text', value, filled)
              if (merged[missing] === value[missing]) return
              onChange(merged, missing)
              setOwnSuggested((prev) => ({ ...prev, [missing]: true }))
              setLang(missing)
            } catch {
              // useFormFill has said what went wrong
            }
          },
        }
      : undefined
  const slot = assist === false ? undefined : (assist ?? ownAssist)

  const control = {
    id: fieldId,
    value: value[lang],
    dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
    placeholder: placeholder?.[lang],
    'aria-label': label ? undefined : ariaLabel,
    autoFocus,
    disabled,
    'aria-invalid': !!error || undefined,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setOwnSuggested((prev) => ({ ...prev, [lang]: false }))
      onChange({ ...value, [lang]: e.target.value }, lang)
    },
  }
  const isSuggested = !!suggested?.[lang] || !!ownSuggested[lang]

  const languageSwitch = only ? null : (
    <ToggleGroup
      type='single'
      size='sm'
      value={lang}
      onValueChange={(next) => next && setLang(next as Lang)}
      aria-label={t('language')}
      className={cn(LANG_TRACK, compact ? 'h-6' : 'h-7')}
    >
      <LangItem
        lang='en'
        filled={value.en.trim() !== ''}
        suggested={!!suggested?.en || !!ownSuggested.en}
      />
      <LangItem
        lang='ar'
        filled={value.ar.trim() !== ''}
        suggested={!!suggested?.ar || !!ownSuggested.ar}
      />
    </ToggleGroup>
  )

  const assistButton = slot && (
    <InputGroupButton
      aria-label={slot.label}
      title={slot.label}
      disabled={slot.disabled || slot.pending}
      onClick={slot.onClick}
      className='text-primary'
    >
      {slot.pending ? <Spinner /> : <Sparkles />}
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

/**
 * The language switch as a segmented control: a grey track, the language being written raised on it as a
 * white chip with dark text, the other one quiet on the track. Before, the one chosen was told only by the
 * theme's accent, a grey next to white, and nobody could see which it was.
 */
const LANG_TRACK = 'bg-muted h-7 gap-0.5 rounded-md p-0.5'
const LANG_CHIP =
  'text-muted-foreground hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground h-full min-w-0 gap-1 rounded-sm px-2 first:rounded-sm last:rounded-sm data-[spacing=0]:first:rounded-sm data-[spacing=0]:last:rounded-sm text-xs font-semibold hover:bg-transparent data-[state=on]:shadow-sm'

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
      className={LANG_CHIP}
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
