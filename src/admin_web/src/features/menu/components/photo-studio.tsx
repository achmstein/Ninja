import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Camera, Check, Wand2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { drawItemPhoto, restageItemPhoto } from '@ninja/api/catalog'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { NinjaMark } from '@/components/ninja-mark'
import { assistErrorMessage } from '@/features/assist/errors'

export type StudioItem = {
  nameEn?: string
  nameAr?: string
  description?: string
  category?: string
}

type Look = 'studio' | 'rustic' | 'overhead' | 'moody' | 'fresh'

/** Each look as a swatch that hints at it: its surface, its light */
const LOOKS: {
  value: Look
  key: TranslationKey
  hint: TranslationKey
  swatch: string
}[] = [
  {
    value: 'studio',
    key: 'lookStudio',
    hint: 'lookStudioHint',
    swatch: 'bg-gradient-to-br from-zinc-50 via-white to-zinc-200',
  },
  {
    value: 'rustic',
    key: 'lookRustic',
    hint: 'lookRusticHint',
    swatch: 'bg-gradient-to-br from-amber-200 via-amber-700 to-amber-950',
  },
  {
    value: 'overhead',
    key: 'lookOverhead',
    hint: 'lookOverheadHint',
    swatch: 'bg-[radial-gradient(circle_at_center,white_0_32%,#e7e0d6_33%_100%)]',
  },
  {
    value: 'moody',
    key: 'lookMoody',
    hint: 'lookMoodyHint',
    swatch: 'bg-gradient-to-br from-zinc-600 via-zinc-900 to-black',
  },
  {
    value: 'fresh',
    key: 'lookFresh',
    hint: 'lookFreshHint',
    swatch: 'bg-gradient-to-br from-white via-emerald-50 to-emerald-200',
  },
]

/** What the studio says while the model works, a step every few seconds */
const STEPS: TranslationKey[] = ['studioStepPlating', 'studioStepLight', 'studioStepShot', 'studioStepDeveloping']

type Draft = { id: number; url: string; file: File; look: Look }

/** The server's problem out of a blob answer, so the error reads as any other assistant error */
async function readableError(error: unknown, t: ReturnType<typeof useT>) {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text())
    } catch {
      // not JSON: the generic message below
    }
  }
  if (
    isAxiosError(error) &&
    error.response?.status === 503 &&
    (error.response.data as { title?: string } | undefined)?.title === 'No image model'
  )
    return t('studioNoImageModel')
  return assistErrorMessage(error)
}

/**
 * A photo studio for one item: pick a look (studio, rustic, overhead,
 * moody, fresh), add a word if you like, and the image model draws it.
 * While it works the frame breathes and says what it is doing; the photo
 * then develops out of a blur. Every draw stays on a strip below to
 * compare, and the one kept goes into the form like a picked file, saved
 * with the item.
 */
export function PhotoStudio({
  open,
  onOpenChange,
  item,
  onUse,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: StudioItem
  onUse: (file: File, url: string) => void
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const [look, setLook] = useState<Look>('studio')
  const [note, setNote] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [shown, setShown] = useState<number | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // From its name (the model draws it) or from the owner's own photo (the model restages it, the label kept)
  const [source, setSource] = useState<'name' | 'photo'>('name')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const nextId = useRef(1)
  const kept = useRef<Set<string>>(new Set())

  // The steps turn while drawing
  useEffect(() => {
    if (!drawing) return
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600)
    return () => clearInterval(timer)
  }, [drawing])

  // Drafts not kept are let go with the studio
  useEffect(
    () => () => {
      for (const d of drafts) if (!kept.current.has(d.url)) URL.revokeObjectURL(d.url)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // The picked photo is let go when another is picked or the studio closes
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url)
    },
    [photo]
  )

  const current = drafts.find((d) => d.id === shown) ?? null
  const name = item.nameEn || item.nameAr || ''
  const canDraw = source === 'name' ? !!name : !!photo
  const pick = (file: File | undefined) => {
    if (!file) return
    setPhoto({ file, url: URL.createObjectURL(file) })
    setShown(null)
    setError(null)
  }

  const draw = async () => {
    setDrawing(true)
    setStep(0)
    setError(null)
    try {
      const { data } =
        source === 'photo' && photo
          ? await restageItemPhoto({
              query: { 'api-version': API_VERSION },
              body: {
                photo: photo.file as unknown as never,
                nameEn: item.nameEn || undefined,
                nameAr: item.nameAr || undefined,
                style: look,
                note: note.trim() || undefined,
              },
              responseType: 'blob',
              throwOnError: true,
            })
          : await drawItemPhoto({
              query: { 'api-version': API_VERSION },
              body: {
                nameEn: item.nameEn || null,
                nameAr: item.nameAr || null,
                description: item.description || null,
                category: item.category || null,
                style: look,
                note: note.trim() || null,
              },
              responseType: 'blob',
              throwOnError: true,
            })
      const blob = data as Blob
      const file = new File([blob], `item-${look}.webp`, { type: 'image/webp' })
      const draft: Draft = {
        id: nextId.current++,
        url: URL.createObjectURL(file),
        file,
        look,
      }
      setDrafts((prev) => [draft, ...prev].slice(0, 8))
      setShown(draft.id)
    } catch (e) {
      setError(await readableError(e, t))
    } finally {
      setDrawing(false)
    }
  }

  const use = () => {
    if (!current) return
    kept.current.add(current.url)
    onUse(current.file, current.url)
    onOpenChange(false)
  }

  const swatch = LOOKS.find((l) => l.value === look)!.swatch

  return (
    <Dialog open={open} onOpenChange={(next) => !drawing && onOpenChange(next)}>
      {/* Wide on a desk: the photo on one side, what shapes it beside it. Block flow, not the dialog's grid:
          a grid row under a capped height let the square stage spill over the lines below it */}
      <DialogContent className='block max-h-[92dvh] overflow-y-auto sm:max-w-lg md:max-w-[58rem]'>
        <DialogHeader className='mb-4'>
          <DialogTitle className='flex items-center gap-2'>
            <NinjaMark className='text-primary size-4' />
            {t('photoStudio')}
          </DialogTitle>
          <DialogDescription className='truncate'>{name || t('photoStudioHint')}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-5 md:grid-cols-[minmax(0,1fr)_22rem]'>
          <div className='min-w-0 space-y-3'>
            {/* The stage: the look's surface while idle, a breathing frame while drawing, the photo developing */}
            <div className={cn('relative aspect-square w-full overflow-hidden rounded-xl border', !current && swatch)}>
              <AnimatePresence mode='popLayout'>
                {current && !drawing && (
                  <motion.img
                    key={current.id}
                    src={current.url}
                    alt=''
                    className='absolute inset-0 size-full object-cover'
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: 'blur(24px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: reduce ? 0.2 : 1.1,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </AnimatePresence>

              {drawing && (
                <div className={cn('absolute inset-0', swatch)}>
                  {!reduce && (
                    <>
                      <motion.div
                        aria-hidden
                        className='bg-primary/30 absolute size-2/3 rounded-full blur-3xl'
                        animate={{
                          x: ['-10%', '60%', '20%', '-10%'],
                          y: ['0%', '30%', '60%', '0%'],
                        }}
                        transition={{
                          duration: 6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                      <motion.div
                        aria-hidden
                        className='absolute size-1/2 rounded-full bg-amber-300/40 blur-3xl'
                        animate={{
                          x: ['70%', '10%', '50%', '70%'],
                          y: ['60%', '20%', '0%', '60%'],
                        }}
                        transition={{
                          duration: 7,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                      {/* A sweep of light across, as a flash would */}
                      <motion.div
                        aria-hidden
                        className='absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent'
                        animate={{ x: ['-150%', '350%'] }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          repeatDelay: 0.6,
                        }}
                      />
                    </>
                  )}
                  <div className='absolute inset-x-0 bottom-0 flex justify-center p-4'>
                    <AnimatePresence mode='wait'>
                      <motion.span
                        key={step}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className='bg-background/85 text-foreground rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur'
                        role='status'
                      >
                        {t(STEPS[step])}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* From a photo: the owner's photo waits on the stage, or a way to take one */}
              {source === 'photo' &&
                !current &&
                !drawing &&
                (photo ? (
                  <>
                    <img src={photo.url} alt='' className='absolute inset-0 size-full object-cover' />
                    <div className='absolute inset-x-0 bottom-0 flex justify-center p-4'>
                      <span className='bg-background/85 rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur'>
                        {t('studioPhotoReady')}
                      </span>
                    </div>
                  </>
                ) : (
                  <label className='absolute inset-0 grid cursor-pointer place-items-center p-6 text-center'>
                    <input
                      type='file'
                      accept='image/*'
                      className='sr-only'
                      onChange={(e) => pick(e.target.files?.[0])}
                    />
                    <span className='bg-background/85 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-3 shadow-sm backdrop-blur'>
                      <Camera className='text-primary size-5' />
                      <span className='text-sm font-medium'>{t('studioPickPhoto')}</span>
                    </span>
                  </label>
                ))}

              {source === 'name' && !current && !drawing && (
                <div className='absolute inset-0 grid place-items-center p-6 text-center'>
                  <div className='bg-background/85 flex flex-col items-center gap-2 rounded-xl px-4 py-3 shadow-sm backdrop-blur'>
                    <Wand2 className='text-primary size-5' />
                    <span className='text-sm font-medium'>{t('studioIdle')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Every draw, to compare and go back to */}
            {drafts.length > 1 && (
              <div className='-mx-1 flex gap-2 overflow-x-auto px-1 py-1'>
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    type='button'
                    onClick={() => setShown(d.id)}
                    disabled={drawing}
                    aria-label={t(LOOKS.find((l) => l.value === d.look)!.key)}
                    className={cn(
                      'size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      d.id === shown ? 'border-primary scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                    )}
                  >
                    <img src={d.url} alt='' className='size-full object-cover' />
                  </button>
                ))}
              </div>
            )}

            {source === 'photo' && photo && (
              <label className='text-primary inline-flex cursor-pointer items-center gap-1.5 self-start text-sm font-medium hover:underline'>
                <input
                  type='file'
                  accept='image/*'
                  className='sr-only'
                  disabled={drawing}
                  onChange={(e) => pick(e.target.files?.[0])}
                />
                <Camera className='size-4' />
                {t('studioChangePhoto')}
              </label>
            )}
          </div>

          <div className='flex min-w-0 flex-col gap-4'>
            {/* From its name, or from the owner's own photo (a branded can keeps its label) */}
            <div role='radiogroup' className='bg-muted grid grid-cols-2 rounded-full p-1'>
              {(['name', 'photo'] as const).map((s) => (
                <button
                  key={s}
                  type='button'
                  role='radio'
                  aria-checked={source === s}
                  disabled={drawing}
                  onClick={() => {
                    setSource(s)
                    setError(null)
                  }}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors',
                    source === s
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s === 'photo' ? <Camera className='size-4' /> : <Wand2 className='size-4' />}
                  {t(s === 'photo' ? 'studioFromPhoto' : 'studioFromName')}
                </button>
              ))}
            </div>
            {source === 'photo' && <p className='text-muted-foreground -mt-2 text-xs'>{t('studioFromPhotoHint')}</p>}

            <div className='space-y-2'>
              <div>
                <span className='text-sm font-medium'>{t('studioLook')}</span>
                <p className='text-muted-foreground text-xs'>{t('studioLookHint')}</p>
              </div>
              {/* Two to a row, so the column is no taller than the photo beside it; what the chosen
                  look is reads under them */}
              <div className='grid grid-cols-2 gap-1.5'>
                {LOOKS.map((l) => (
                  <button
                    key={l.value}
                    type='button'
                    onClick={() => setLook(l.value)}
                    disabled={drawing}
                    aria-pressed={look === l.value}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-1.5 text-start text-sm transition-colors',
                      look === l.value
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'hover:bg-muted/60 border-transparent'
                    )}
                  >
                    <span className={cn('relative size-9 shrink-0 rounded-full border shadow-xs', l.swatch)}>
                      {look === l.value && (
                        <Check className='bg-primary text-primary-foreground absolute -end-1 -top-1 size-4 rounded-full p-0.5' />
                      )}
                    </span>
                    <span className='min-w-0 truncate'>{t(l.key)}</span>
                  </button>
                ))}
              </div>
              <p className='text-muted-foreground text-xs' aria-live='polite'>
                {t(LOOKS.find((l) => l.value === look)!.hint)}
              </p>
            </div>

            <div className='space-y-1.5'>
              <label htmlFor='studio-note' className='text-sm font-medium'>
                {t('studioNote')}
              </label>
              {/* Room to say it in a sentence or two; Enter is a new line, Ctrl or Cmd with it draws */}
              <Textarea
                id='studio-note'
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder={t('studioNotePlaceholder')}
                disabled={drawing}
                className='min-h-20 resize-none'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !drawing && canDraw) {
                    e.preventDefault()
                    void draw()
                  }
                }}
              />
            </div>

            {error && <p className='text-destructive text-sm'>{error}</p>}

            <div className='flex flex-col-reverse gap-2 sm:flex-row md:mt-auto [&>button]:sm:flex-1'>
              <Button
                type='button'
                variant={current ? 'outline' : 'default'}
                disabled={drawing || !canDraw}
                onClick={() => void draw()}
              >
                <NinjaMark />
                {drawing
                  ? t('studioDrawing')
                  : current
                    ? t('studioDrawAgain')
                    : source === 'photo'
                      ? t('studioRestage')
                      : t('studioDraw')}
              </Button>
              {current && (
                <Button type='button' disabled={drawing} onClick={use}>
                  <Check />
                  {t('studioUse')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
