import { createContext, useContext, useId, useState } from 'react'
import { type LocalizedText } from '@/api/catalog'
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

/** From the API's nullable pair to form state */
export function toLocalizedValue(
  text: LocalizedText | null | undefined
): LocalizedValue {
  return { en: text?.en ?? '', ar: text?.ar ?? '' }
}

/** Back to the API's shape: trimmed, an empty Arabic becomes null */
export function fromLocalizedValue(value: LocalizedValue): {
  en: string
  ar: string | null
} {
  return { en: value.en.trim(), ar: value.ar.trim() || null }
}

const LangContext = createContext<{
  lang: Lang
  setLang: (lang: Lang) => void
} | null>(null)

/**
 * Wrap a form in this so every localized field on it switches language
 * together: pick Arabic once, fill in all the Arabic names, done.
 */
export function LocalizedFields({
  defaultLang = 'en',
  children,
}: {
  defaultLang?: Lang
  children: React.ReactNode
}) {
  const [lang, setLang] = useState<Lang>(defaultLang)
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
  /** Visible label; give `ariaLabel` instead inside a labelled grid */
  label?: React.ReactNode
  ariaLabel?: string
  value: LocalizedValue
  onChange: (value: LocalizedValue) => void
  id?: string
  /** A textarea instead of a single line */
  multiline?: boolean
  rows?: number
  placeholder?: Partial<Record<Lang, string>>
  /** Shown under the field and marks it invalid */
  error?: string
  autoFocus?: boolean
  /** The h-8 size used inside dense editors */
  compact?: boolean
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
  compact,
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
      onChange({ ...value, [lang]: e.target.value }),
  }

  const languageSwitch = (
    <ToggleGroup
      type='single'
      size='sm'
      value={lang}
      onValueChange={(next) => next && setLang(next as Lang)}
      aria-label={t('language')}
      className={compact ? 'h-6' : 'h-7'}
    >
      <LangItem lang='en' filled={value.en.trim() !== ''} />
      <LangItem lang='ar' filled={value.ar.trim() !== ''} />
    </ToggleGroup>
  )

  return (
    <div className={cn(label && 'space-y-2', className)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <InputGroup className={cn(compact && 'h-8')}>
        {multiline ? (
          <>
            <InputGroupTextarea rows={rows} {...control} />
            <InputGroupAddon align='block-end' className='justify-end'>
              {languageSwitch}
            </InputGroupAddon>
          </>
        ) : (
          <>
            <InputGroupInput className={cn(compact && 'h-8')} {...control} />
            <InputGroupAddon align='inline-end'>
              {languageSwitch}
            </InputGroupAddon>
          </>
        )}
      </InputGroup>
      {error && <p className='text-destructive text-sm'>{error}</p>}
    </div>
  )
}

function LangItem({ lang, filled }: { lang: Lang; filled: boolean }) {
  const t = useT()
  return (
    <ToggleGroupItem
      value={lang}
      className='h-full min-w-0 gap-1 px-2 text-xs font-semibold'
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
