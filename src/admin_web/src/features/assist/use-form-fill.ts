import { useMutation } from '@tanstack/react-query'
import { type FormField } from '@/api/catalog'
import { fillFormMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useContentLanguages } from '@/lib/content-languages'
import { type LocalizedValue } from '@/lib/localized-value'
import { toast } from '@/lib/toast'
import { assistErrorMessage, useAssistStore } from './errors'

// Wire values of Catalog's FormFieldType (the enum has no string converter)
const FIELD_TYPE = { text: 0, long: 1, number: 2, choice: 3, yesno: 4 } as const

/** One field of a form as the assistant sees it */
export type FillField = {
  key: string
  /** What the owner reads above it, in English */
  label: string
  type: keyof typeof FIELD_TYPE
  value: string | number | boolean | null | undefined
  options?: { value: string; label: string }[]
  language?: 'en' | 'ar'
}

/** A two-language text as its two fields: "name.en" and "name.ar" */
export function localizedFields(
  key: string,
  label: string,
  value: LocalizedValue,
  long = false
): FillField[] {
  const type = long ? 'long' : 'text'
  return [
    {
      key: `${key}.en`,
      label: `${label} (English)`,
      type,
      value: value.en,
      language: 'en',
    },
    {
      key: `${key}.ar`,
      label: `${label} (Arabic)`,
      type,
      value: value.ar,
      language: 'ar',
    },
  ]
}

/** Puts filled "name.en" / "name.ar" back into a two-language value, keeping what was typed */
export function mergeLocalized(
  key: string,
  value: LocalizedValue,
  filled: Record<string, string>
): LocalizedValue {
  return {
    en: value.en.trim() ? value.en : (filled[`${key}.en`] ?? value.en),
    ar: value.ar.trim() ? value.ar : (filled[`${key}.ar`] ?? value.ar),
  }
}

const isEmpty = (value: FillField['value']) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '')

/**
 * Why a form cannot be filled yet: nothing typed to fill from, or nothing
 * left empty; null when it can.
 */
export function fillBlocker(
  fields: FillField[]
): 'assistTypeSomethingFirst' | 'assistNothingMissing' | null {
  if (fields.every((f) => isEmpty(f.value))) return 'assistTypeSomethingFirst'
  if (fields.every((f) => !isEmpty(f.value))) return 'assistNothingMissing'
  return null
}

/**
 * The assistant fills a whole form: every empty field it can tell from the
 * ones typed. The answer is a map of key to value, only for fields that were
 * empty; the caller puts each into its state and marks it suggested. Hidden
 * (`available === false`) once the server says it has no assistant.
 */
export function useFormFill() {
  const available = useAssistStore((s) => !s.unavailable)
  const languages = useContentLanguages()
  const mutation = useMutation({
    ...fillFormMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const fill = async (
    form: string,
    fields: FillField[]
  ): Promise<Record<string, string>> => {
    const body: FormField[] = fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: FIELD_TYPE[f.type],
      value: isEmpty(f.value) ? null : String(f.value),
      options: f.options ?? null,
      language: f.language ?? null,
    }))
    const response = await mutation.mutateAsync({
      body: { form, fields: body, languages },
      query: { 'api-version': API_VERSION },
    })
    return Object.fromEntries(response.values.map((v) => [v.key, v.value]))
  }

  return { fill, isPending: mutation.isPending, available }
}
