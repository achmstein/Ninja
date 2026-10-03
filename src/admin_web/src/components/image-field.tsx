import { useRef, type ReactNode } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/field'

const ACCEPT_PHOTO = 'image/png,image/jpeg,image/webp'

/**
 * Every picture the admin takes (a dish's photo, the logo, the cover) in
 * one shape: the picture or an empty tile, and beside it one row of what
 * can be done to it (Upload or Replace, the AI's way to make one, Remove)
 * over one line on what it wants. The tile is a way to upload too.
 */
export function ImageField({
  label,
  hint,
  src,
  busy = false,
  shape = 'square',
  accept = ACCEPT_PHOTO,
  onFile,
  onRemove,
  assist,
  removeLabel,
  contain,
}: {
  label?: ReactNode
  /** One line under the actions: the size it wants, where it shows */
  hint?: ReactNode
  src: string | null
  busy?: boolean
  /** square: a dish, a mark; wide: a wordmark; photo: a cover, cropped */
  shape?: 'square' | 'wide' | 'photo'
  accept?: string
  onFile: (file: File) => void
  onRemove?: () => void
  /** An AiButton that makes the picture */
  assist?: ReactNode
  removeLabel?: string
  /** A logo shows whole, never cropped; a photo fills its tile */
  contain?: boolean
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const pick = () => input.current?.click()

  const body = (
    <div className='flex items-center gap-4'>
      <button
        type='button'
        onClick={pick}
        disabled={busy}
        aria-label={src ? t('replaceImage') : t('uploadLogo')}
        className={cn(
          'bg-muted hover:bg-muted/70 grid h-20 shrink-0 place-items-center overflow-hidden rounded-lg border transition-colors',
          shape === 'square' ? 'w-20' : shape === 'photo' ? 'w-52' : 'w-40'
        )}
      >
        {busy ? (
          <Spinner />
        ) : src ? (
          <img
            src={src}
            alt=''
            className={cn(
              'h-full w-full',
              shape === 'wide' || contain
                ? 'object-contain p-1'
                : 'object-cover'
            )}
          />
        ) : (
          <ImagePlus className='text-muted-foreground size-6' />
        )}
      </button>
      <div className='flex min-w-0 flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={busy}
            onClick={pick}
          >
            <Upload />
            {src ? t('replaceImage') : t('uploadLogo')}
          </Button>
          {assist}
          {src && onRemove && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              disabled={busy}
              onClick={onRemove}
            >
              <X />
              {removeLabel ?? t('remove')}
            </Button>
          )}
        </div>
        {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
      </div>
      <input
        ref={input}
        type='file'
        accept={accept}
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )

  return label ? <Field label={label}>{body}</Field> : body
}
