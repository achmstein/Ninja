import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useT, type TranslationKey } from '@/lib/i18n'
import { isMark, isPhoto, type ImageSlot } from '@/lib/brand-slots'
import { cleanLogo, releaseLogo, type CleanedLogo, type LogoChoice, type LogoImage } from '@/lib/logo-cleanup'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

/** The most the server keeps on the long side: the mark 1024, a wide logo 1600 (TenantBrandStore). */
const maxSideOf = (slot: ImageSlot) => (isMark(slot) ? 1024 : 1600)

/** The dark mode slot a light one's logo can fill */
const DARK_OF: Partial<Record<ImageSlot, ImageSlot>> = {
  logo: 'logo-dark',
  'wordmark-en': 'wordmark-en-dark',
  'wordmark-ar': 'wordmark-ar-dark',
}

type Choice = 'original' | 'outside' | 'inside'
const CHOICE_LABELS: Record<Choice, TranslationKey> = {
  original: 'logoAsUploaded',
  outside: 'logoCutOutside',
  inside: 'logoCutInside',
}

/** The surfaces the slots and the apps show a logo on (lib/logo-cleanup's) */
const LIGHT = '#ffffff'
const DARK = '#18181b'

/** A file for a slot */
export type SlotImage = { slot: ImageSlot; file: File }

type Pending = { slot: ImageSlot; logo: CleanedLogo; choice: Choice; fillDark: boolean }

/**
 * What a choice puts in its slot and, for a light slot, what it can put in the dark one: a logo the slot's
 * own surface would swallow is the version made for it; a dark logo offers the version made for the dark
 * surface, and a white mark (made into a dark one for the light slot) offers itself as it was.
 */
function plan(slot: ImageSlot, choice: LogoChoice): { own: LogoImage; dark: LogoImage | null } {
  if (slot.endsWith('-dark')) return { own: choice.onDark ?? choice, dark: null }
  return {
    own: choice.onLight ?? choice,
    dark: DARK_OF[slot] ? (choice.onDark ?? (choice.onLight ? choice : null)) : null,
  }
}

type Options = {
  /** Saves (or holds) the files, in order: the slot's, then the dark slot's when it is filled too */
  onUse: (images: SlotImage[]) => void
  /** Whether a slot holds an image now: a dark slot already filled is not offered to be filled again */
  hasImage?: (slot: ImageSlot) => boolean
}

/**
 * A logo or wide logo picked for a slot goes through here first. An SVG is
 * drawn as a PNG; a plain background is found and taken out; and the logo is
 * shown on the light and the dark surface, made again for the one that would
 * swallow it (Chillax's black turned white for dark mode, a white mark
 * darkened for light mode), with the dark slot filled from it. A dialog shows
 * the ways to save it, each change swept in over what was picked, whatever the
 * logo needed (one with no plain background is said to be kept as it is). A
 * photo goes straight on.
 */
export function useLogoCleanup({ onUse, hasImage }: Options): {
  pick: (slot: ImageSlot, file: File) => void
  /** The slot whose file is being read */
  busySlot: ImageSlot | null
  dialog: ReactNode
} {
  const t = useT()
  const [busySlot, setBusySlot] = useState<ImageSlot | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const pick = async (slot: ImageSlot, file: File) => {
    if (isPhoto(slot)) return onUse([{ slot, file }])
    setBusySlot(slot)
    let logo: CleanedLogo
    try {
      logo = await cleanLogo(file, maxSideOf(slot))
    } catch {
      // Not readable here: the server says why
      return onUse([{ slot, file }])
    } finally {
      setBusySlot(null)
    }
    const choice: Choice = logo.outside ? 'outside' : 'original'
    const { dark } = plan(slot, logo[choice]!)
    const darkSlot = DARK_OF[slot]
    setPending({ slot, logo, choice, fillDark: Boolean(dark && darkSlot && !hasImage?.(darkSlot)) })
  }

  const close = () => {
    if (pending) releaseLogo(pending.logo)
    setPending(null)
  }

  const confirm = () => {
    if (!pending) return
    const { own, dark } = plan(pending.slot, pending.logo[pending.choice] ?? pending.logo.original)
    const darkSlot = DARK_OF[pending.slot]
    onUse([
      { slot: pending.slot, file: own.file },
      ...(pending.fillDark && dark && darkSlot ? [{ slot: darkSlot, file: dark.file }] : []),
    ])
    close()
  }

  const choices = pending
    ? (['original', 'outside', 'inside'] as const).flatMap((choice) => {
        const image = pending.logo[choice]
        return image ? [{ choice, image }] : []
      })
    : []
  const chosen = pending ? (pending.logo[pending.choice] ?? pending.logo.original) : null
  const result = pending && chosen ? plan(pending.slot, chosen) : null
  const darkSlotOnly = pending?.slot.endsWith('-dark') ?? false

  // What the dark surface shows: a dark slot its own logo; a light slot's logo the dark one it fills, or
  // itself when the dark slot is left alone (the apps fall back to it), with a word when that loses it
  const darkNote = (): string | undefined => {
    if (!pending || !chosen || !result) return undefined
    if (darkSlotOnly) return result.own !== chosen ? t('logoMadeForDark') : undefined
    if (pending.fillDark && result.dark) return t('logoMadeForDark')
    return result.dark ? t('logoLostOnDark') : undefined
  }

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('logoCleanTitle')}</DialogTitle>
          <DialogDescription>{t('logoCleanDescription')}</DialogDescription>
        </DialogHeader>
        {pending && chosen && result && (
          <div className='space-y-5'>
            {pending.logo.background === 'none' && (
              <p className='text-muted-foreground text-sm'>{t('logoNoPlainBackground')}</p>
            )}
            {choices.length > 1 && (
              <div className={cn('grid gap-3', choices.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                {choices.map(({ choice, image }, i) => (
                  <ChoiceTile
                    key={choice}
                    label={t(CHOICE_LABELS[choice])}
                    before={pending.logo.original.url}
                    image={image}
                    dark={darkSlotOnly}
                    order={i}
                    selected={pending.choice === choice}
                    onSelect={() => setPending({ ...pending, choice })}
                  />
                ))}
              </div>
            )}

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('logoHowItShows')}</p>
              <div className={cn('grid gap-3', !darkSlotOnly && 'sm:grid-cols-2')}>
                {!darkSlotOnly && (
                  <SurfaceTile
                    key={`light-${pending.choice}`}
                    label={t('logoOnLight')}
                    surface={LIGHT}
                    before={chosen.url}
                    after={result.own.url}
                    note={result.own !== chosen ? t('logoMadeForLight') : undefined}
                  />
                )}
                <SurfaceTile
                  key={`dark-${pending.choice}-${pending.fillDark}`}
                  label={t('logoOnDark')}
                  surface={DARK}
                  before={darkSlotOnly ? chosen.url : result.own.url}
                  after={
                    darkSlotOnly ? result.own.url : pending.fillDark && result.dark ? result.dark.url : result.own.url
                  }
                  note={darkNote()}
                />
              </div>
              {result.dark && DARK_OF[pending.slot] && (
                <div className='flex items-start gap-2 pt-1'>
                  <Checkbox
                    id='logo-fill-dark'
                    checked={pending.fillDark}
                    onCheckedChange={(checked) => setPending({ ...pending, fillDark: checked === true })}
                  />
                  <Label htmlFor='logo-fill-dark' className='leading-snug font-normal'>
                    {t('logoFillDark')}
                  </Label>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type='button' variant='outline' onClick={close}>
            {t('cancel')}
          </Button>
          <Button type='button' onClick={confirm}>
            {t('logoUseChoice')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { pick: (slot, file) => void pick(slot, file), busySlot, dialog }
}

/** A checkerboard shows what is see-through; a dark slot's checkerboard is dark. */
const checker = (dark: boolean) => {
  const [a, b] = dark ? ['#18181b', '#27272a'] : ['#ffffff', '#e4e4e7']
  return {
    background: `repeating-conic-gradient(${a} 0% 25%, ${b} 0% 50%) 50% / 16px 16px`,
  }
}

const SWEEP_EASE = [0.65, 0, 0.35, 1] as const

/**
 * The picture as it was, and what it becomes swept in over it from the start edge, a bright line leading:
 * the change seen being made rather than a second picture beside the first. Still under reduced motion.
 */
function Sweep({ before, after, delay = 0 }: { before: string; after: string; delay?: number }) {
  const reduced = useReducedMotion()
  if (reduced || before === after) return <img src={after} alt='' className='max-h-full max-w-full object-contain' />
  return (
    <div className='relative flex h-full w-full items-center justify-center'>
      {/* The picture as it was gives way behind the line: where the new one is clear (a removed
          background) nothing of the old shows through it */}
      <motion.div
        className='absolute inset-0 flex items-center justify-center'
        initial={{ clipPath: 'inset(0 0 0 0%)' }}
        animate={{ clipPath: 'inset(0 0 0 100%)' }}
        transition={{ duration: 0.9, delay, ease: SWEEP_EASE }}
      >
        <img src={before} alt='' className='max-h-full max-w-full object-contain' />
      </motion.div>
      <motion.div
        className='absolute inset-0 flex items-center justify-center'
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 0.9, delay, ease: SWEEP_EASE }}
      >
        <img src={after} alt='' className='max-h-full max-w-full object-contain' />
      </motion.div>
      <motion.div
        aria-hidden
        className='pointer-events-none absolute inset-y-0 w-0.5 bg-sky-400 shadow-[0_0_12px_2px_rgb(56_189_248/0.7)]'
        initial={{ left: '0%', opacity: 0 }}
        animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
        transition={{
          duration: 0.9,
          delay,
          ease: SWEEP_EASE,
          opacity: { duration: 0.9, delay, times: [0, 0.1, 0.85, 1] },
        }}
      />
    </div>
  )
}

function ChoiceTile({
  label,
  before,
  image,
  dark,
  order,
  selected,
  onSelect,
}: {
  label: string
  before: string
  image: LogoImage
  dark: boolean
  order: number
  selected: boolean
  onSelect: () => void
}) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      type='button'
      aria-pressed={selected}
      onClick={onSelect}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32, delay: order * 0.06 }}
      className={cn(
        'flex flex-col gap-2 rounded-lg border-2 p-2 text-start transition-colors',
        selected ? 'border-primary' : 'hover:border-muted-foreground/40 border-transparent'
      )}
    >
      <div
        className='flex h-32 items-center justify-center overflow-hidden rounded-md border p-3'
        style={checker(dark)}
      >
        <Sweep before={before} after={image.url} delay={0.15 + order * 0.12} />
      </div>
      <span className='text-sm font-medium'>{label}</span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {image.width}×{image.height}
      </span>
    </motion.button>
  )
}

/** The logo on a surface the apps show it on, the change made for that surface swept in. */
function SurfaceTile({
  label,
  surface,
  before,
  after,
  note,
}: {
  label: string
  surface: string
  before: string
  after: string
  note?: string
}) {
  return (
    <div className='space-y-1.5'>
      <div
        className='flex h-32 items-center justify-center overflow-hidden rounded-md border p-4'
        style={{ background: surface }}
      >
        <Sweep before={before} after={after} delay={0.35} />
      </div>
      <div className='flex flex-wrap items-baseline justify-between gap-x-2'>
        <span className='text-sm'>{label}</span>
        {note && <span className='text-muted-foreground text-xs'>{note}</span>}
      </div>
    </div>
  )
}
