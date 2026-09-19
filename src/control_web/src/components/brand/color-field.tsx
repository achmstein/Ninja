import { useEffect, useState } from 'react'
import { Pipette, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { extractSwatches, pickColor, supportsEyeDropper } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const DEFAULT_COLOR = '#18181b'

type ColorFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  fallback?: string
  /** What the empty field says; the default is the platform's own colour */
  placeholder?: string
  /** An image whose colours are offered as swatches (a file being picked, or a URL) */
  swatchesFrom?: File | string | null
  /** The eyedropper, where the browser has one */
  eyedropper?: boolean
  className?: string
}

/**
 * A colour: the native picker, the hex, a clear button; and when there is a
 * logo, the colours it is made of as swatches, plus the browser's eyedropper
 * where it has one (Chrome, Edge), so the brand colour is the logo's own.
 */
export function ColorField({
  id,
  label,
  value,
  onChange,
  fallback = DEFAULT_COLOR,
  placeholder,
  swatchesFrom,
  eyedropper,
  className,
}: ColorFieldProps) {
  const t = useT()
  const [swatches, setSwatches] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    if (!swatchesFrom) {
      setSwatches([])
      return
    }
    extractSwatches(swatchesFrom)
      .then((found) => {
        if (!cancelled) setSwatches(found)
      })
      .catch(() => {
        if (!cancelled) setSwatches([])
      })
    return () => {
      cancelled = true
    }
  }, [swatchesFrom])

  const canDrop = eyedropper && supportsEyeDropper()

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className='text-xs'>
        {label}
      </Label>
      <div className='flex items-center gap-2'>
        <input
          id={id}
          type='color'
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className='h-9 w-11 cursor-pointer rounded-md border bg-transparent p-1'
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder={placeholder ?? t('defaultOption')}
          className='font-mono'
          dir='ltr'
          maxLength={7}
        />
        {canDrop && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='size-9 shrink-0'
                aria-label={t('eyedropper')}
                onClick={async () => {
                  const picked = await pickColor()
                  if (picked) onChange(picked)
                }}
              >
                <Pipette className='size-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('eyedropper')}</TooltipContent>
          </Tooltip>
        )}
        {value && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-8 shrink-0'
            aria-label={t('defaultOption')}
            onClick={() => onChange('')}
          >
            <X className='size-3.5' />
          </Button>
        )}
      </div>
      {swatches.length > 0 && (
        <div className='flex items-center gap-1.5' aria-label={t('swatches')}>
          {swatches.map((swatch) => (
            <Tooltip key={swatch}>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  aria-label={swatch}
                  onClick={() => onChange(swatch)}
                  style={{ backgroundColor: swatch }}
                  className={cn(
                    'size-6 rounded-md border transition-transform hover:scale-110',
                    value === swatch && 'ring-ring ring-2 ring-offset-1'
                  )}
                />
              </TooltipTrigger>
              <TooltipContent className='font-mono'>{swatch}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  )
}
