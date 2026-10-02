import { useState, type ReactNode } from 'react'
import { isMark, isPhoto, type ImageSlot } from '@/lib/brand-slots'
import { useT, type TranslationKey } from '@/lib/i18n'
import {
  cleanLogo,
  releaseLogo,
  type CleanedLogo,
  type LogoChoice,
} from '@/lib/logo-cleanup'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** The most the server keeps on the long side: the mark 1024, a wide logo 1600 (TenantBrandStore). */
const maxSideOf = (slot: ImageSlot) => (isMark(slot) ? 1024 : 1600)

type Choice = 'original' | 'outside' | 'inside'
const CHOICE_LABELS: Record<Choice, TranslationKey> = {
  original: 'logoAsUploaded',
  outside: 'logoCutOutside',
  inside: 'logoCutInside',
}

type Pending = { slot: ImageSlot; logo: CleanedLogo; choice: Choice }

/**
 * A logo or wide logo picked for a slot goes through here first. An SVG is
 * drawn as a PNG; a plain background is found and a dialog shows the logo
 * as uploaded beside the logo cut out, to pick from. A photo, or a logo with
 * no plain background, goes straight on.
 */
export function useLogoCleanup(
  /** Saves (or holds) the file for the slot */
  onUse: (slot: ImageSlot, file: File) => void
): {
  pick: (slot: ImageSlot, file: File) => void
  /** The slot whose file is being read */
  busySlot: ImageSlot | null
  dialog: ReactNode
} {
  const t = useT()
  const [busySlot, setBusySlot] = useState<ImageSlot | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const pick = async (slot: ImageSlot, file: File) => {
    if (isPhoto(slot)) return onUse(slot, file)
    setBusySlot(slot)
    let logo: CleanedLogo
    try {
      logo = await cleanLogo(file, maxSideOf(slot))
    } catch {
      // Not readable here: the server says why
      return onUse(slot, file)
    } finally {
      setBusySlot(null)
    }
    if (!logo.outside) {
      // Nothing to choose: as uploaded (an SVG drawn as a PNG)
      onUse(slot, logo.original.file)
      releaseLogo(logo)
      return
    }
    setPending({ slot, logo, choice: 'outside' })
  }

  const close = () => {
    if (pending) releaseLogo(pending.logo)
    setPending(null)
  }

  const confirm = () => {
    if (!pending) return
    const chosen = pending.logo[pending.choice] ?? pending.logo.original
    onUse(pending.slot, chosen.file)
    close()
  }

  const choices = pending
    ? (['original', 'outside', 'inside'] as const).flatMap((choice) => {
        const image = pending.logo[choice]
        return image ? [{ choice, image }] : []
      })
    : []

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('logoCleanTitle')}</DialogTitle>
          <DialogDescription>{t('logoCleanDescription')}</DialogDescription>
        </DialogHeader>
        {pending && (
          <div
            className={cn(
              'grid gap-3',
              choices.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            )}
          >
            {choices.map(({ choice, image }) => (
              <ChoiceTile
                key={choice}
                label={t(CHOICE_LABELS[choice])}
                image={image}
                dark={pending.slot.endsWith('-dark')}
                selected={pending.choice === choice}
                onSelect={() => setPending({ ...pending, choice })}
              />
            ))}
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

function ChoiceTile({
  label,
  image,
  dark,
  selected,
  onSelect,
}: {
  label: string
  image: LogoChoice
  dark: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded-lg border-2 p-2 text-start transition-colors',
        selected
          ? 'border-primary'
          : 'hover:border-muted-foreground/40 border-transparent'
      )}
    >
      <div
        className='flex h-36 items-center justify-center overflow-hidden rounded-md border p-3'
        style={checker(dark)}
      >
        <img
          src={image.url}
          alt=''
          className='max-h-full max-w-full object-contain'
        />
      </div>
      <span className='text-sm font-medium'>{label}</span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {image.width}×{image.height}
      </span>
    </button>
  )
}
