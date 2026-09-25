import { useRef } from 'react'
import { ChevronDown, ImagePlus, X } from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import {
  MAIN_SLOTS,
  VARIANT_SLOTS,
  isMark,
  isPhoto,
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
  cover: 'brandCover',
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'
// A photo is never a vector
const ACCEPT_PHOTO = 'image/png,image/jpeg,image/webp'

type ImageSlotFieldProps = {
  slot: ImageSlot
  /** What the slot shows now: a URL (an object URL for a picked file), or nothing */
  src: string | null
  busy?: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  /** A line under the slot on the size it wants and where it shows */
  hint?: string
}

/** One image slot: the picture (or an empty tile), upload, remove. The dark slots sit on a dark tile so a light logo reads. */
export function ImageSlotField({ slot, src, busy, onUpload, onRemove, hint }: ImageSlotFieldProps) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const dark = slot.endsWith('-dark')
  const photo = isPhoto(slot)
  return (
    <div className='space-y-2'>
      <Label className='text-xs'>{t(SLOT_LABELS[slot])}</Label>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          className={cn(
            'flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-md border',
            dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-muted hover:bg-muted/80',
            isMark(slot) ? 'w-20' : photo ? 'w-52' : 'w-40'
          )}
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={t('uploadImage')}
        >
          {busy ? (
            <Spinner className={cn(dark && 'text-zinc-100')} />
          ) : src ? (
            <img src={src} alt='' className={cn('h-full w-full', photo ? 'object-cover' : 'object-contain p-1')} />
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
          accept={photo ? ACCEPT_PHOTO : ACCEPT}
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
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

/** The two slots every café fills and the cover photo, then the four variants behind a disclosure. */
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
      {/* Only the banner header shows it, so it asks for nothing more than a photo */}
      <ImageSlotField
        slot='cover'
        src={srcOf('cover')}
        busy={busySlot === 'cover'}
        onUpload={(file) => onUpload('cover', file)}
        onRemove={() => onRemove('cover')}
        hint={t('brandCoverHint')}
      />
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
