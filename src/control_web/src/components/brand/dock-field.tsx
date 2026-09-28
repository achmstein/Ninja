import { useT } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DEFAULT_COLOR } from './color-field'

/** The dock's colour: 'brand' a deep shade of the brand colour, 'neutral' black; its buttons keep the brand colour either way */
export type Dock = 'brand' | 'neutral'

/** The record's value (null or 'neutral') as the field reads it */
export const dockOf = (slab: string | null | undefined): Dock => (slab === 'neutral' ? 'neutral' : 'brand')

/**
 * The customer app's dock, the café's to choose: a deep shade of its brand
 * colour, or black. Each choice shows its colour as a swatch, as the colour
 * fields beside it do.
 */
export function DockField({ value, onChange, color }: { value: Dock; onChange: (value: Dock) => void; color: string }) {
  const t = useT()
  const brand = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR
  const choices: Array<{ key: Dock; label: string; fill: string }> = [
    // Near the customer app's own shade (lib/brand-theme.ts there): the brand's hue, very dark
    { key: 'brand', label: t('dockBrand'), fill: `color-mix(in oklab, ${brand} 30%, black)` },
    { key: 'neutral', label: t('dockBlack'), fill: '#111113' },
  ]
  return (
    <div className='grid gap-2'>
      <Label>{t('dockColour')}</Label>
      <ToggleGroup
        type='single'
        variant='outline'
        value={value}
        onValueChange={(v) => v && onChange(v as Dock)}
        aria-label={t('dockColour')}
        className='w-full'
      >
        {choices.map((c) => (
          <ToggleGroupItem key={c.key} value={c.key} className='h-auto flex-1 gap-2 py-2'>
            <span aria-hidden className='size-5 shrink-0 rounded-md border' style={{ backgroundColor: c.fill }} />
            {c.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className='text-muted-foreground text-xs'>{t('dockColourHint')}</p>
    </div>
  )
}
