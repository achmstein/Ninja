import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { drawDishPhoto } from '@/api/catalog'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { assistErrorMessage } from '@/features/assist/errors'

export type StudioDish = {
  nameEn?: string
  nameAr?: string
  description?: string
  category?: string
}

type Look = 'studio' | 'rustic' | 'overhead' | 'moody' | 'fresh'

/** Each look as a swatch that hints at it: its surface, its light */
const LOOKS: { value: Look; key: TranslationKey; swatch: string }[] = [
  {
    value: 'studio',
    key: 'lookStudio',
    swatch: 'bg-gradient-to-br from-zinc-50 via-white to-zinc-200',
  },
  {
    value: 'rustic',
    key: 'lookRustic',
    swatch: 'bg-gradient-to-br from-amber-200 via-amber-700 to-amber-950',
  },
  {
    value: 'overhead',
    key: 'lookOverhead',
    swatch:
      'bg-[radial-gradient(circle_at_center,white_0_32%,#e7e0d6_33%_100%)]',
  },
  {
    value: 'moody',
    key: 'lookMoody',
    swatch: 'bg-gradient-to-br from-zinc-600 via-zinc-900 to-black',
  },
  {
    value: 'fresh',
    key: 'lookFresh',
    swatch: 'bg-gradient-to-br from-white via-emerald-50 to-emerald-200',
  },
]

/** What the studio says while the model works, a step every few seconds */
const STEPS: TranslationKey[] = [
  'studioStepPlating',
  'studioStepLight',
  'studioStepShot',
  'studioStepDeveloping',
]

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
    (error.response.data as { title?: string } | undefined)?.title ===
      'No image model'
  )
    return t('studioNoImageModel')
  return assistErrorMessage(error)
}

/**
 * A photo studio for one dish: pick a look (studio, rustic, overhead,
 * moody, fresh), add a word if you like, and the image model draws it.
 * While it works the frame breathes and says what it is doing; the photo
 * then develops out of a blur. Every draw stays on a strip below to
 * compare, and the one kept goes into the form like a picked file, saved
 * with the dish.
 */
export function PhotoStudio({
  open,
  onOpenChange,
  dish,
  onUse,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish: StudioDish
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
  const nextId = useRef(1)
  const kept = useRef<Set<string>>(new Set())

  // The steps turn while drawing
  useEffect(() => {
    if (!drawing) return
    const timer = setInterval(
      () => setStep((s) => (s + 1) % STEPS.length),
      2600
    )
    return () => clearInterval(timer)
  }, [drawing])

  // Drafts not kept are let go with the studio
  useEffect(
    () => () => {
      for (const d of drafts)
        if (!kept.current.has(d.url)) URL.revokeObjectURL(d.url)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const current = drafts.find((d) => d.id === shown) ?? null
  const name = dish.nameEn || dish.nameAr || ''

  const draw = async () => {
    setDrawing(true)
    setStep(0)
    setError(null)
    try {
      const { data } = await drawDishPhoto({
        query: { 'api-version': API_VERSION },
        body: {
          nameEn: dish.nameEn || null,
          nameAr: dish.nameAr || null,
          description: dish.description || null,
          category: dish.category || null,
          style: look,
          note: note.trim() || null,
        },
        responseType: 'blob',
        throwOnError: true,
      })
      const blob = data as Blob
      const file = new File([blob], `dish-${look}.webp`, { type: 'image/webp' })
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
      <DialogContent className='max-h-[92dvh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary size-4' />
            {t('photoStudio')}
          </DialogTitle>
          <DialogDescription className='truncate'>
            {name || t('photoStudioHint')}
          </DialogDescription>
        </DialogHeader>

        {/* The stage: the look's surface while idle, a breathing frame while drawing, the photo developing */}
        <div
          className={cn(
            'relative aspect-square w-full overflow-hidden rounded-xl border',
            !current && swatch
          )}
        >
          <AnimatePresence mode='popLayout'>
            {current && !drawing && (
              <motion.img
                key={current.id}
                src={current.url}
                alt=''
                className='absolute inset-0 size-full object-cover'
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 1.08, filter: 'blur(24px)' }
                }
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

          {!current && !drawing && (
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
                  d.id === shown
                    ? 'border-primary scale-105'
                    : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                <img src={d.url} alt='' className='size-full object-cover' />
              </button>
            ))}
          </div>
        )}

        <div className='space-y-2'>
          <span className='text-sm font-medium'>{t('studioLook')}</span>
          <div className='-mx-1 flex gap-2 overflow-x-auto px-1 pb-1'>
            {LOOKS.map((l) => (
              <button
                key={l.value}
                type='button'
                onClick={() => setLook(l.value)}
                disabled={drawing}
                aria-pressed={look === l.value}
                className={cn(
                  'flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 text-xs transition-colors',
                  look === l.value
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'relative size-12 rounded-full border shadow-xs',
                    l.swatch,
                    look === l.value && 'ring-primary ring-2 ring-offset-2'
                  )}
                >
                  {look === l.value && (
                    <Check className='bg-primary text-primary-foreground absolute -end-1 -top-1 size-4 rounded-full p-0.5' />
                  )}
                </span>
                {t(l.key)}
              </button>
            ))}
          </div>
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder={t('studioNotePlaceholder')}
          disabled={drawing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !drawing && name) {
              e.preventDefault()
              void draw()
            }
          }}
        />

        {error && <p className='text-destructive text-sm'>{error}</p>}

        <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
          <Button
            type='button'
            variant={current ? 'outline' : 'default'}
            disabled={drawing || !name}
            onClick={() => void draw()}
          >
            <Sparkles />
            {drawing
              ? t('studioDrawing')
              : current
                ? t('studioDrawAgain')
                : t('studioDraw')}
          </Button>
          {current && (
            <Button type='button' disabled={drawing} onClick={use}>
              <Check />
              {t('studioUse')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
