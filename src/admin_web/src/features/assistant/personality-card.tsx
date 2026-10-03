import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setTenantAssistantMutation } from '@/api/tenant/@tanstack/react-query.gen'
import { brandQueryKey, useBrand, type Brand } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field } from '@/components/field'
import { SettingRow, SettingsCard } from '@/components/kit'
import {
  LANGUAGES,
  NOTES_MAX,
  samePersonality,
  toPersonalityForm,
  toPersonalityRequest,
  type AssistantLanguage,
  type Manner,
  type PersonalityForm,
  type Tone,
} from './personality'

const LANGUAGE_LABELS: Record<AssistantLanguage, TranslationKey> = {
  match: 'assistantLanguageMatch',
  en: 'assistantLanguageEn',
  'ar-eg': 'assistantLanguageArEg',
  ar: 'assistantLanguageAr',
}

const LANGUAGE_PREVIEW: Record<AssistantLanguage, TranslationKey> = {
  match: 'assistantPreviewMatch',
  en: 'assistantPreviewEn',
  'ar-eg': 'assistantPreviewArEg',
  ar: 'assistantPreviewAr',
}

/** The server's one-line reason, when the error carried ProblemDetails. */
function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  const data = e.response?.data as { detail?: string } | undefined
  return data?.detail
}

/** How the owner's assistant speaks, kept on the business's brand. */
export function PersonalityCard() {
  const brand = useBrand()
  const t = useT()
  return (
    <SettingsCard
      title={t('assistantPersonalityTitle')}
      description={t('assistantPersonalityHint')}
    >
      {/* Keyed on the version so a save elsewhere re-seeds the form */}
      {brand ? (
        <PersonalityFields key={String(brand.version)} brand={brand} />
      ) : (
        <div className='px-5 py-4'>
          <Skeleton className='h-72 w-full' />
        </div>
      )}
    </SettingsCard>
  )
}

function PersonalityFields({ brand }: { brand: Brand }) {
  const t = useT()
  const queryClient = useQueryClient()
  const saved = toPersonalityForm(brand.assistant)
  const [form, setForm] = useState<PersonalityForm>(saved)
  const [problem, setProblem] = useState<string | null>(null)
  const set = <K extends keyof PersonalityForm>(
    key: K,
    value: PersonalityForm[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = useMutation({
    ...setTenantAssistantMutation(),
    onSuccess: (data) => {
      queryClient.setQueryData(brandQueryKey(), data)
      toast.success(t('assistantPersonalitySaved'))
    },
    onError: (e) => {
      const detail = problemDetail(e)
      setProblem(detail ?? null)
      toast.error(detail || t('assistantPersonalitySaveFailed'))
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setProblem(null)
    save.mutate({ body: toPersonalityRequest(form) })
  }

  const preview = t('assistantPreview', {
    tone: t(
      form.tone === 'detailed'
        ? 'assistantPreviewDetailed'
        : 'assistantPreviewBrief'
    ),
    manner: t(
      form.manner === 'formal'
        ? 'assistantPreviewFormal'
        : 'assistantPreviewFriendly'
    ),
    language: t(LANGUAGE_PREVIEW[form.language]),
  })

  return (
    <form onSubmit={submit} className='divide-border/60 divide-y'>
      <SettingRow
        title={t('assistantLanguage')}
        control={
          <Select
            value={form.language}
            onValueChange={(v) => set('language', v as AssistantLanguage)}
          >
            <SelectTrigger
              id='assistant-language'
              aria-label={t('assistantLanguage')}
              className='w-full sm:w-60'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(LANGUAGE_LABELS[l])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        title={t('assistantTone')}
        control={
          <ToggleGroup
            type='single'
            variant='outline'
            aria-label={t('assistantTone')}
            value={form.tone}
            onValueChange={(v) => v && set('tone', v as Tone)}
          >
            <ToggleGroupItem value='brief' className='px-4'>
              {t('assistantToneBrief')}
            </ToggleGroupItem>
            <ToggleGroupItem value='detailed' className='px-4'>
              {t('assistantToneDetailed')}
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <SettingRow
        title={t('assistantManner')}
        control={
          <ToggleGroup
            type='single'
            variant='outline'
            aria-label={t('assistantManner')}
            value={form.manner}
            onValueChange={(v) => v && set('manner', v as Manner)}
          >
            <ToggleGroupItem value='friendly' className='px-4'>
              {t('assistantMannerFriendly')}
            </ToggleGroupItem>
            <ToggleGroupItem value='formal' className='px-4'>
              {t('assistantMannerFormal')}
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className='grid gap-4 px-5 py-4'>
        <Field
          label={t('assistantNotes')}
          htmlFor='assistant-notes'
          hint={t('assistantNotesHint')}
          end={
            <span className='text-muted-foreground text-xs tabular-nums'>
              {form.notes.length}/{NOTES_MAX}
            </span>
          }
        >
          <Textarea
            id='assistant-notes'
            rows={4}
            value={form.notes}
            maxLength={NOTES_MAX}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        {/* What it will sound like, said back as the owner picks */}
        <p className='bg-muted/50 rounded-lg px-3 py-2 text-sm'>{preview}</p>
      </div>
      <div className='flex flex-wrap items-center justify-end gap-3 px-5 py-4'>
        <p
          className={
            problem
              ? 'text-destructive me-auto text-sm'
              : 'text-muted-foreground me-auto text-sm'
          }
        >
          {problem ?? t('assistantPersonalityTakesEffect')}
        </p>
        <Button
          type='submit'
          disabled={save.isPending || samePersonality(form, saved)}
        >
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </div>
    </form>
  )
}
