import { useEffect, useMemo, useRef, useState } from 'react'
import { isAxiosError, type AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImageUp, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  designPromotion,
  type PromotionDto,
  type PromotionRequest,
} from '@/api/catalog'
import {
  createPromotionMutation,
  listCategoriesOptions,
  listItemsOptions,
  updatePromotionMutation,
  uploadPromotionPictureMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { formatDay } from '@/lib/business-day'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DatePicker } from '@/components/date-picker'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid, SwitchRow } from '@/components/field'
import { LocalizedInput } from '@/components/localized-input'
import { NinjaMark } from '@/components/ninja-mark'
import { ToggleChip } from '@/components/toggle-chip'
import { assistErrorMessage } from '@/features/assist/errors'
import { useAiAvailable } from '@/features/assist/use-ai-available'
import { promotionPictureUrl } from '@/features/menu/pictures'

type Link = 'None' | 'Item' | 'Category' | 'Book'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const A_SUNDAY = Date.UTC(2023, 0, 1)

// The window is picked by day: it starts at the first day's midnight and ends when the day after the last one begins
const dayStart = (day: string) => new Date(`${day}T00:00:00`)
const lastDayOf = (endsAt: string) => {
  const end = new Date(endsAt)
  end.setDate(end.getDate() - 1)
  return formatDay(end)
}

/** What the designer says while the model works, a step every few seconds */
const STEPS = [
  'promoStepReading',
  'promoStepLight',
  'promoStepLayout',
  'promoStepWords',
] as const

export function PromotionSheet({
  open,
  onOpenChange,
  promotion,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  promotion: PromotionDto | null
}) {
  const t = useT()
  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={promotion ? t('editPromotion') : t('newPromotion')}
    >
      {/* Keyed so its state starts afresh for each promotion; closing unmounts it */}
      <PromotionForm
        key={String(promotion?.id ?? 'new')}
        promotion={promotion}
        onOpenChange={onOpenChange}
      />
    </EntitySheet>
  )
}

function PromotionForm({
  promotion,
  onOpenChange,
}: {
  promotion: PromotionDto | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const aiAvailable = useAiAvailable()
  const { branches } = useAllowedBranches()

  const [form, setForm] = useState({
    headline: {
      en: promotion?.headline.en ?? '',
      ar: promotion?.headline.ar ?? '',
    },
    link: (promotion?.link as Link | undefined) ?? 'None',
    linkId: promotion?.linkId != null ? String(promotion.linkId) : '',
    branchIds: (promotion?.branchIds ?? []).map(Number),
    from: promotion?.startsAt ? formatDay(new Date(promotion.startsAt)) : '',
    until: promotion?.endsAt ? lastDayOf(promotion.endsAt) : '',
    weekdays: Number(promotion?.weekdays ?? 0),
    showFrom: promotion?.showFrom?.slice(0, 5) ?? '',
    showTo: promotion?.showTo?.slice(0, 5) ?? '',
    isActive: promotion?.isActive ?? true,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // The picture: the one saved, or a new one (the owner's own, or a design picked) to upload with the save
  const [picture, setPicture] = useState<{ file: File; url: string } | null>(
    null
  )
  const shown =
    picture?.url ??
    (promotion?.pictureUri
      ? promotionPictureUrl(promotion.id, promotion.pictureUri, 640)
      : null)
  const [error, setError] = useState('')

  const items = useQuery({
    ...listItemsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: form.link === 'Item',
  })
  const categories = useQuery({
    ...listCategoriesOptions({ query: { 'api-version': API_VERSION } }),
    enabled: form.link === 'Category',
  })

  const weekdayName = (day: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(A_SUNDAY + day * 86_400_000)
    )

  const create = useMutation(createPromotionMutation())
  const update = useMutation(updatePromotionMutation())
  const upload = useMutation(uploadPromotionPictureMutation())
  const saving = create.isPending || update.isPending || upload.isPending

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.headline.en.trim() && !form.headline.ar.trim())
      return setError(t('promotionHeadlineRequired'))
    if (!shown) return setError(t('promotionPictureRequired'))
    if ((form.link === 'Item' || form.link === 'Category') && !form.linkId)
      return setError(t('promotionLinkRequired'))
    setError('')

    const body: PromotionRequest = {
      headline: form.headline,
      link: form.link,
      linkId:
        form.link === 'Item' || form.link === 'Category'
          ? Number(form.linkId)
          : null,
      branchIds: form.branchIds,
      startsAt: form.from ? dayStart(form.from).toISOString() : null,
      endsAt: form.until
        ? (() => {
            const end = dayStart(form.until)
            end.setDate(end.getDate() + 1)
            return end.toISOString()
          })()
        : null,
      weekdays: form.weekdays || null,
      showFrom: form.showFrom && form.showTo ? form.showFrom : null,
      showTo: form.showFrom && form.showTo ? form.showTo : null,
      isActive: form.isActive,
    }
    try {
      const saved = promotion
        ? await update.mutateAsync({
            path: { id: Number(promotion.id) },
            body,
            query: { 'api-version': API_VERSION },
          })
        : await create.mutateAsync({
            body,
            query: { 'api-version': API_VERSION },
          })
      if (picture)
        await upload.mutateAsync({
          path: { id: Number(saved.id) },
          body: { file: picture.file },
          query: { 'api-version': API_VERSION },
        })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPromotions' }] })
      toast.success(t('promotionSaved'))
      onOpenChange(false)
    } catch (err) {
      const detail = (
        (err as AxiosError).response?.data as { detail?: string } | undefined
      )?.detail
      toast.error(detail || t('failedToSavePromotion'))
    }
  }

  return (
    <form id='promotion-form' onSubmit={save} className='space-y-5'>
      <LocalizedInput
        label={t('promotionHeadline')}
        value={form.headline}
        onChange={(headline) => set('headline', headline)}
        placeholder={{
          en: 'Waffle Wednesday · 20% off',
          ar: 'أربعاء الوافل · خصم ٢٠٪',
        }}
        autoFocus={!promotion}
      />

      <PictureStage
        shown={shown}
        headline={form.headline}
        aiAvailable={aiAvailable}
        onPicture={(file) =>
          setPicture((old) => {
            if (old) URL.revokeObjectURL(old.url)
            return { file, url: URL.createObjectURL(file) }
          })
        }
      />

      <Field label={t('promotionButton')} hint={t('promotionButtonHint')}>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Select
            value={form.link}
            onValueChange={(v) => {
              set('link', v as Link)
              set('linkId', '')
            }}
          >
            <SelectTrigger className='w-full sm:w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='None'>{t('promotionLinkNone')}</SelectItem>
              <SelectItem value='Item'>{t('promotionLinkItem')}</SelectItem>
              <SelectItem value='Category'>
                {t('promotionLinkCategory')}
              </SelectItem>
              <SelectItem value='Book'>{t('promotionLinkBook')}</SelectItem>
            </SelectContent>
          </Select>
          {(form.link === 'Item' || form.link === 'Category') && (
            <Select value={form.linkId} onValueChange={(v) => set('linkId', v)}>
              <SelectTrigger className='w-full'>
                <SelectValue
                  placeholder={
                    form.link === 'Item'
                      ? t('promotionPickItem')
                      : t('promotionPickCategory')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(form.link === 'Item'
                  ? (items.data ?? []).map((i) => ({ id: i.id, name: i.name }))
                  : (categories.data ?? []).map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))
                ).map((o) => (
                  <SelectItem key={String(o.id)} value={String(o.id)}>
                    {localized(o.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Field>

      {branches.length > 1 && (
        <Field label={t('promotionBranches')} hint={t('promotionBranchesHint')}>
          <div className='flex flex-wrap gap-1.5'>
            {branches.map((b) => {
              const id = Number(b.id)
              const on =
                form.branchIds.length === 0 || form.branchIds.includes(id)
              return (
                <ToggleChip
                  key={id}
                  on={on}
                  onToggle={() => {
                    const all = branches.map((x) => Number(x.id))
                    const current =
                      form.branchIds.length === 0 ? all : form.branchIds
                    const next = current.includes(id)
                      ? current.filter((x) => x !== id)
                      : [...current, id]
                    set(
                      'branchIds',
                      next.length === all.length || next.length === 0
                        ? []
                        : next
                    )
                  }}
                >
                  {localized(b.name)}
                </ToggleChip>
              )
            })}
          </div>
        </Field>
      )}

      <FieldGrid>
        <Field label={t('validFrom')}>
          <DatePicker
            value={form.from}
            onChange={(v) => set('from', v)}
            placeholder={t('always')}
          />
        </Field>
        <Field label={t('validUntil')}>
          <DatePicker
            value={form.until}
            onChange={(v) => set('until', v)}
            placeholder={t('always')}
          />
        </Field>
      </FieldGrid>

      {/* Any weekday off means it sleeps that day; the hours are optional and may run past midnight */}
      <Field label={t('promotionWhen')}>
        <div className='space-y-2'>
          <div className='flex flex-wrap gap-1'>
            {WEEKDAYS.map((day) => {
              const bit = 1 << day
              const on = form.weekdays === 0 || (form.weekdays & bit) !== 0
              return (
                <ToggleChip
                  key={day}
                  on={on}
                  compact
                  className='w-11'
                  onToggle={() => {
                    const all = 127
                    const next =
                      (form.weekdays === 0 ? all : form.weekdays) ^ bit
                    set('weekdays', next === all || next === 0 ? 0 : next)
                  }}
                >
                  {weekdayName(day)}
                </ToggleChip>
              )
            })}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              type='time'
              className='w-32'
              aria-label={t('offerFrom')}
              value={form.showFrom}
              onChange={(e) => set('showFrom', e.target.value)}
            />
            <span className='text-muted-foreground text-xs'>–</span>
            <Input
              type='time'
              className='w-32'
              aria-label={t('offerTo')}
              value={form.showTo}
              onChange={(e) => set('showTo', e.target.value)}
            />
          </div>
        </div>
      </Field>

      <SwitchRow
        title={t('promotionOn')}
        description={t('promotionOnHint')}
        checked={form.isActive}
        onCheckedChange={(v) => set('isActive', v)}
      />

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <SheetActions>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' form='promotion-form' disabled={saving}>
          {saving && <Spinner />}
          {t('save')}
        </Button>
      </SheetActions>
    </form>
  )
}

/** The data: URL a design came back as, as a file to upload like a picked one */
function fileOf(dataUrl: string, name: string): File {
  const [, b64] = dataUrl.split(',')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type: 'image/webp' })
}

/**
 * The brand's logo as a file to send with the photo, or undefined: none set,
 * not reachable, or a vector one (the designer draws pixels and leaves an SVG
 * out, writing the name instead)
 */
async function logoFile(
  url: string | null | undefined
): Promise<File | undefined> {
  if (!url) return undefined
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.type.includes('svg'))
      return undefined
    return new File([blob], 'logo', { type: blob.type })
  } catch {
    return undefined
  }
}

/**
 * The picture, the shape the popup shows it in: the owner's own design
 * uploaded as it is, or Ninja's designs from a real photo of theirs (the
 * item, the room) with the headline drawn in. A few come back at once to
 * pick from; a note asks again ("warmer", "fix the spelling").
 */
function PictureStage({
  shown,
  headline,
  aiAvailable,
  onPicture,
}: {
  shown: string | null
  headline: { en: string; ar: string }
  aiAvailable: boolean
  onPicture: (file: File) => void
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const language = useLanguage((s) => s.language)
  const brand = useBrand()
  const own = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [designs, setDesigns] = useState<string[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [designing, setDesigning] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // The words drawn: the language the owner reads the admin in, else the one written
  const words = useMemo(() => {
    const first = language === 'ar' ? headline.ar : headline.en
    return (first || headline.en || headline.ar).trim()
  }, [language, headline])

  useEffect(() => {
    if (!designing) return
    const timer = setInterval(
      () => setStep((s) => (s + 1) % STEPS.length),
      2800
    )
    return () => clearInterval(timer)
  }, [designing])

  const design = async () => {
    if (!photo) return
    setDesigning(true)
    setStep(0)
    setError(null)
    try {
      // The real logo goes on each design as it is; without one the name is written small instead
      const logo = await logoFile(brand?.logoUrl)
      const { data } = await designPromotion({
        query: { 'api-version': API_VERSION },
        body: {
          photo: photo.file as unknown as never,
          logo: logo as unknown as never,
          headline: words,
          business:
            (language === 'ar' ? brand?.name.ar : brand?.name.en) ||
            brand?.name.en ||
            brand?.name.ar ||
            undefined,
          colors: brand?.primaryColor ?? undefined,
          note: note.trim() || undefined,
          count: 3,
        },
        throwOnError: true,
      })
      setDesigns(data.designs)
      setPicked(null)
    } catch (e) {
      setError(
        isAxiosError(e) &&
          e.response?.status === 503 &&
          (e.response.data as { title?: string } | undefined)?.title ===
            'No image model'
          ? t('studioNoImageModel')
          : assistErrorMessage(e)
      )
    } finally {
      setDesigning(false)
    }
  }

  const pick = (index: number) => {
    setPicked(index)
    onPicture(fileOf(designs[index], `promotion-${index + 1}.webp`))
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-start gap-4'>
        {/* The popup's own shape */}
        <div className='bg-muted relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl border sm:w-44'>
          <AnimatePresence mode='popLayout'>
            {shown && !designing ? (
              <motion.img
                key={shown}
                src={shown}
                alt=''
                className='absolute inset-0 size-full object-cover'
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 1.06, filter: 'blur(16px)' }
                }
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{
                  duration: reduce ? 0.2 : 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            ) : designing ? (
              <motion.div
                key='designing'
                className='from-primary/20 via-muted to-primary/10 absolute inset-0 grid place-items-end bg-gradient-to-br p-2'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {!reduce && (
                  <motion.div
                    aria-hidden
                    className='absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent'
                    animate={{ x: ['-150%', '350%'] }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      repeatDelay: 0.5,
                    }}
                  />
                )}
                <AnimatePresence mode='wait'>
                  <motion.span
                    key={step}
                    role='status'
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className='bg-background/85 relative w-full rounded-full px-2 py-1 text-center text-[11px] font-medium shadow-sm backdrop-blur'
                  >
                    {t(STEPS[step])}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className='text-muted-foreground absolute inset-0 grid place-items-center p-3 text-center text-xs'>
                {t('promotionNoPicture')}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          <p className='text-muted-foreground text-xs'>
            {t('promotionPictureHint')}
          </p>
          {aiAvailable && (
            <Button
              type='button'
              variant='outline'
              className='justify-start'
              disabled={designing}
              onClick={() => photoInput.current?.click()}
            >
              <NinjaMark />
              {photo
                ? t('promotionChangePhoto')
                : t('promotionDesignFromPhoto')}
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            className='justify-start'
            disabled={designing}
            onClick={() => own.current?.click()}
          >
            <ImageUp />
            {t('promotionUploadOwn')}
          </Button>
          <input
            ref={own}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPicked(null)
                onPicture(file)
              }
              e.target.value = ''
            }}
          />
          <input
            ref={photoInput}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPhoto((old) => {
                  if (old) URL.revokeObjectURL(old.url)
                  return { file, url: URL.createObjectURL(file) }
                })
                setDesigns([])
              }
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* The designer: the real photo, a note, and the designs to pick from */}
      {photo && (
        <div className='bg-muted/40 space-y-3 rounded-xl border p-3'>
          <div className='flex items-center gap-3'>
            <img
              src={photo.url}
              alt=''
              className='size-12 shrink-0 rounded-lg object-cover'
            />
            <div className='min-w-0 flex-1 text-xs'>
              <p className='font-medium'>{t('promotionYourPhoto')}</p>
              <p className='text-muted-foreground truncate'>
                {words ? `“${words}”` : t('promotionWriteHeadlineFirst')}
              </p>
            </div>
          </div>

          {designs.length > 0 && (
            <div className='grid grid-cols-3 gap-2'>
              {designs.map((d, i) => (
                <button
                  key={d.slice(-24)}
                  type='button'
                  onClick={() => pick(i)}
                  disabled={designing}
                  className={cn(
                    'relative aspect-[4/5] overflow-hidden rounded-lg border-2 transition-all',
                    picked === i
                      ? 'border-primary'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  )}
                >
                  <img src={d} alt='' className='size-full object-cover' />
                  {picked === i && (
                    <Check className='bg-primary text-primary-foreground absolute end-1 top-1 size-5 rounded-full p-0.5' />
                  )}
                </button>
              ))}
            </div>
          )}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder={t('promotionNotePlaceholder')}
            disabled={designing}
          />
          {error && <p className='text-destructive text-sm'>{error}</p>}
          <Button
            type='button'
            className='w-full'
            disabled={designing || !words}
            onClick={() => void design()}
          >
            {designs.length > 0 ? <RotateCcw /> : <NinjaMark />}
            {designing
              ? t('promotionDesigning')
              : designs.length > 0
                ? t('promotionDesignAgain')
                : t('promotionDesign')}
          </Button>
          {designs.length > 0 && (
            <p className='text-muted-foreground text-center text-xs'>
              {t('promotionPickHint')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
