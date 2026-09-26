import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { setTenantAssistantMutation } from '@/api/tenant/@tanstack/react-query.gen'
import { brandQueryKey, useBrand, type Brand } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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

/** How the owner's assistant speaks, kept on the café's brand. */
export function PersonalityCard() {
  const brand = useBrand()
  const t = useT()
  return (
    <div className='space-y-2'>
      <Card>
        <CardContent className='pt-6'>
          {/* Keyed on the version so a save elsewhere re-seeds the form */}
          {brand ? (
            <PersonalityFields key={String(brand.version)} brand={brand} />
          ) : (
            <Skeleton className='h-80 w-full' />
          )}
        </CardContent>
      </Card>
      <p className='text-muted-foreground px-1 text-xs'>{t('assistantPersonalityTakesEffect')}</p>
    </div>
  )
}

function PersonalityFields({ brand }: { brand: Brand }) {
  const t = useT()
  const queryClient = useQueryClient()
  const saved = toPersonalityForm(brand.assistant)
  const [form, setForm] = useState<PersonalityForm>(saved)
  const [problem, setProblem] = useState<string | null>(null)
  const set = <K extends keyof PersonalityForm>(key: K, value: PersonalityForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

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
    tone: t(form.tone === 'detailed' ? 'assistantPreviewDetailed' : 'assistantPreviewBrief'),
    manner: t(form.manner === 'formal' ? 'assistantPreviewFormal' : 'assistantPreviewFriendly'),
    language: t(LANGUAGE_PREVIEW[form.language]),
  })

  return (
    <form onSubmit={submit} className='space-y-5'>
      <div className='flex items-start gap-3'>
        <div className='bg-muted grid size-10 shrink-0 place-items-center rounded-lg'>
          <UserRound className='size-5' />
        </div>
        <div className='min-w-0 space-y-1'>
          <h2 className='font-semibold'>{t('assistantPersonalityTitle')}</h2>
          <p className='text-muted-foreground text-sm'>{t('assistantPersonalityHint')}</p>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1.5 sm:col-span-2'>
          <Label htmlFor='assistant-language'>{t('assistantLanguage')}</Label>
          <Select
            value={form.language}
            onValueChange={(v) => set('language', v as AssistantLanguage)}
          >
            <SelectTrigger id='assistant-language' className='w-full'>
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
        </div>
        <div className='space-y-1.5'>
          <Label>{t('assistantTone')}</Label>
          <ToggleGroup
            type='single'
            variant='outline'
            value={form.tone}
            onValueChange={(v) => v && set('tone', v as Tone)}
            className='w-full'
          >
            <ToggleGroupItem value='brief' className='flex-1 px-4'>
              {t('assistantToneBrief')}
            </ToggleGroupItem>
            <ToggleGroupItem value='detailed' className='flex-1 px-4'>
              {t('assistantToneDetailed')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className='space-y-1.5'>
          <Label>{t('assistantManner')}</Label>
          <ToggleGroup
            type='single'
            variant='outline'
            value={form.manner}
            onValueChange={(v) => v && set('manner', v as Manner)}
            className='w-full'
          >
            <ToggleGroupItem value='friendly' className='flex-1 px-4'>
              {t('assistantMannerFriendly')}
            </ToggleGroupItem>
            <ToggleGroupItem value='formal' className='flex-1 px-4'>
              {t('assistantMannerFormal')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className='space-y-1.5'>
        <div className='flex items-baseline justify-between gap-2'>
          <Label htmlFor='assistant-notes'>{t('assistantNotes')}</Label>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {form.notes.length}/{NOTES_MAX}
          </span>
        </div>
        <Textarea
          id='assistant-notes'
          rows={4}
          value={form.notes}
          maxLength={NOTES_MAX}
          onChange={(e) => set('notes', e.target.value)}
        />
        <p className='text-muted-foreground text-xs'>{t('assistantNotesHint')}</p>
      </div>

      <p className='bg-muted/50 rounded-lg border px-3 py-2 text-sm'>{preview}</p>

      {problem && <p className='text-destructive text-sm'>{problem}</p>}

      <div className='flex justify-end'>
        <Button type='submit' disabled={save.isPending || samePersonality(form, saved)}>
          {save.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )
}
