import { useRef } from 'react'
import { ChevronDown, ImagePlus, X } from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import {
  MAIN_SLOTS,
  VARIANT_SLOTS,
  isMark,
  type ImageSlot,
} from '@/lib/brand-slots'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export const SLOT_LABELS: Record<ImageSlot, TranslationKey> = {
  logo: 'brandLogo',
  'logo-dark': 'brandLogoDark',
  'wordmark-en': 'brandWordmarkEn',
  'wordmark-en-dark': 'brandWordmarkEnDark',
  'wordmark-ar': 'brandWordmarkAr',
  'wordmark-ar-dark': 'brandWordmarkArDark',
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'

type ImageSlotFieldProps = {
  slot: ImageSlot
  /** What the slot shows now: a URL (an object URL for a picked file), or nothing */
  src: string | null
  busy?: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}

/** One image slot: the picture (or an empty tile), upload, remove. The dark slots sit on a dark tile so a light logo reads. */
export function ImageSlotField({ slot, src, busy, onUpload, onRemove }: ImageSlotFieldProps) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const dark = slot.endsWith('-dark')
  return (
    <div className='space-y-2'>
      <Label className='text-xs'>{t(SLOT_LABELS[slot])}</Label>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          className={cn(
            'flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-md border',
            dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-muted hover:bg-muted/80',
            isMark(slot) ? 'w-20' : 'w-40'
          )}
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={t('uploadImage')}
        >
          {busy ? (
            <Spinner className={cn(dark && 'text-zinc-100')} />
          ) : src ? (
            <img src={src} alt='' className='h-full w-full object-contain p-1' />
          ) : (
            <ImagePlus className={cn('size-6', dark ? 'text-zinc-500' : 'text-muted-foreground')} />
          )}
        </button>
        <div className='flex flex-col gap-1'>
          <Button type='button' variant='outline' size='sm' disabled={busy} onClick={() => input.current?.click()}>
            {t('uploadImage')}
          </Button>
          {src && (
            <Button type='button' variant='ghost' size='sm' className='text-destructive' disabled={busy} onClick={onRemove}>
              <X className='me-1 size-3.5' />
              {t('removeImage')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type='file'
          accept={ACCEPT}
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

type ImageSlotGridProps = {
  srcOf: (slot: ImageSlot) => string | null
  busySlot?: ImageSlot | null
  onUpload: (slot: ImageSlot, file: File) => void
  onRemove: (slot: ImageSlot) => void
  /** Open the dark and Arabic slots from the start (when any of them is filled) */
  defaultOpen?: boolean
}

/** The two slots every café fills, then the four variants behind a disclosure. */
export function ImageSlotGrid({ srcOf, busySlot, onUpload, onRemove, defaultOpen }: ImageSlotGridProps) {
  const t = useT()
  const field = (slot: ImageSlot) => (
    <ImageSlotField
      key={slot}
      slot={slot}
      src={srcOf(slot)}
      busy={busySlot === slot}
      onUpload={(file) => onUpload(slot, file)}
      onRemove={() => onRemove(slot)}
    />
  )
  return (
    <div className='space-y-4'>
      <div className='grid gap-6 sm:grid-cols-2'>{MAIN_SLOTS.map(field)}</div>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger asChild>
          <Button type='button' variant='ghost' size='sm' className='group -ms-2'>
            <ChevronDown className='me-1 size-4 transition-transform group-data-[state=open]:rotate-180' />
            {t('brandVariants')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='grid gap-6 pt-4 sm:grid-cols-2'>
          {VARIANT_SLOTS.map(field)}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
