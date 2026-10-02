import { createContext, useContext, useId, useState } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type Lang = 'en' | 'ar'

/** Both languages as plain strings, the shape a form keeps in state */
export type LocalizedValue = { en: string; ar: string }

type LocalizedText = { en?: string | null; ar?: string | null }

/** From the API's nullable pair to form state */
export function toLocalizedValue(
  text: LocalizedText | null | undefined
): LocalizedValue {
  return { en: text?.en ?? '', ar: text?.ar ?? '' }
}

/** Back to the API's shape: trimmed, an empty side becomes null; a business may go by one language */
export function fromLocalizedValue(value: LocalizedValue): {
  en: string | null
  ar: string | null
} {
  return { en: value.en.trim() || null, ar: value.ar.trim() || null }
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
 * Wrap a form in this so every localized field on it switches language
 * together: pick Arabic once, fill in all the Arabic names, done. Starts
 * in the UI's language unless `defaultLang` says otherwise.
 */
export function LocalizedFields({
  defaultLang,
  children,
}: {
  defaultLang?: Lang
  children: React.ReactNode
}) {
  const [lang, setLang] = useState<Lang>(defaultLang ?? 'en')
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

function useLang(): [Lang, (lang: Lang) => void] {
  const shared = useContext(LangContext)
  const [local, setLocal] = useState<Lang>('en')
  return shared ? [shared.lang, shared.setLang] : [local, setLocal]
}

type LocalizedInputProps = {
  label?: React.ReactNode
  ariaLabel?: string
  value: LocalizedValue
  /** The whole value, plus which language was just typed */
  onChange: (value: LocalizedValue, lang: Lang) => void
  id?: string
  multiline?: boolean
  rows?: number
  placeholder?: Partial<Record<Lang, string>>
  /** Shown under the field and marks it invalid */
  error?: string
  autoFocus?: boolean
  className?: string
}

/**
 * One field for a bilingual text. The switch at its end picks which
 * language is being typed; the other language's item shows a dot while it
 * is still empty, so nothing gets published half-translated by accident.
 */
export function LocalizedInput({
  label,
  ariaLabel,
  value,
  onChange,
  id,
  multiline,
  rows = 2,
  placeholder,
  error,
  autoFocus,
  className,
}: LocalizedInputProps) {
  const t = useT()
  const generated = useId()
  const fieldId = id ?? generated
  const [lang, setLang] = useLang()

  const control = {
    id: fieldId,
    value: value[lang],
    dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
    placeholder: placeholder?.[lang],
    'aria-label': label ? undefined : ariaLabel,
    autoFocus,
    'aria-invalid': !!error || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [lang]: e.target.value }, lang),
  }

  const languageSwitch = (
    <ToggleGroup
      type='single'
      size='sm'
      value={lang}
      onValueChange={(next) => next && setLang(next as Lang)}
      aria-label={t('language')}
      className={LANG_TRACK}
    >
      <LangItem lang='en' filled={value.en.trim() !== ''} />
      <LangItem lang='ar' filled={value.ar.trim() !== ''} />
    </ToggleGroup>
  )

  return (
    <div className={cn(label && 'space-y-2', className)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <InputGroup>
        {multiline ? (
          <>
            <InputGroupTextarea rows={rows} {...control} />
            <InputGroupAddon align='block-end' className='justify-end'>
              {languageSwitch}
            </InputGroupAddon>
          </>
        ) : (
          <>
            <InputGroupInput {...control} />
            <InputGroupAddon align='inline-end'>{languageSwitch}</InputGroupAddon>
          </>
        )}
      </InputGroup>
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

function LangItem({ lang, filled }: { lang: Lang; filled: boolean }) {
  const t = useT()
  return (
    <ToggleGroupItem
      value={lang}
      className={LANG_CHIP}
      aria-label={lang === 'en' ? t('english') : t('arabic')}
    >
      {lang === 'en' ? 'EN' : 'ع'}
      {!filled && (
        <span
          className='bg-warning size-1.5 rounded-full'
          aria-hidden
          title={lang === 'en' ? t('english') : t('arabic')}
        />
      )}
    </ToggleGroupItem>
  )
}
