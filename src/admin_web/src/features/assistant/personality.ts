import type { AssistantDto } from '@/api/tenant'

export const NAME_MAX = 40
export const NOTES_MAX = 1000

export type Tone = 'brief' | 'detailed'
export type Manner = 'friendly' | 'formal'
export type AssistantLanguage = 'match' | 'en' | 'ar-eg' | 'ar'

export const LANGUAGES: AssistantLanguage[] = ['match', 'en', 'ar-eg', 'ar']

/** The owner's settings as the form edits them: every part filled with its default. */
export type PersonalityForm = {
  name: string
  tone: Tone
  manner: Manner
  language: AssistantLanguage
  notes: string
}

/** Unset or unknown means the default: brief, friendly, in the owner's language. */
export function toPersonalityForm(dto: AssistantDto | null | undefined): PersonalityForm {
  return {
    name: dto?.name ?? '',
    tone: dto?.tone === 'detailed' ? 'detailed' : 'brief',
    manner: dto?.manner === 'formal' ? 'formal' : 'friendly',
    language: LANGUAGES.includes(dto?.language as AssistantLanguage)
      ? (dto!.language as AssistantLanguage)
      : 'match',
    notes: dto?.notes ?? '',
  }
}

/** What the server keeps: a default goes as null, so it follows the platform's default. */
export function toPersonalityRequest(form: PersonalityForm): AssistantDto {
  return {
    name: form.name.trim() || null,
    tone: form.tone === 'brief' ? null : form.tone,
    manner: form.manner === 'friendly' ? null : form.manner,
    language: form.language === 'match' ? null : form.language,
    notes: form.notes.trim() || null,
  }
}

export function samePersonality(a: PersonalityForm, b: PersonalityForm): boolean {
  const x = toPersonalityRequest(a)
  const y = toPersonalityRequest(b)
  return (
    x.name === y.name &&
    x.tone === y.tone &&
    x.manner === y.manner &&
    x.language === y.language &&
    x.notes === y.notes
  )
}
