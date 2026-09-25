import { ChevronDown } from 'lucide-react'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { LayoutForm } from '@/lib/layout-form'
import {
  LAYOUT_PARTS,
  STYLE_KEYS,
  STYLES,
  styleOf,
  type LayoutPart,
  type StyleKey,
} from '@/lib/styles'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STYLE_LABELS: Record<StyleKey, { name: TranslationKey; hint: TranslationKey }> = {
  classic: { name: 'styleClassic', hint: 'styleClassicHint' },
  minimal: { name: 'styleMinimal', hint: 'styleMinimalHint' },
  bold: { name: 'styleBold', hint: 'styleBoldHint' },
  cozy: { name: 'styleCozy', hint: 'styleCozyHint' },
  night: { name: 'styleNight', hint: 'styleNightHint' },
}

const PART_LABELS: Record<LayoutPart, TranslationKey> = {
  menuItem: 'layoutMenuItem',
  categories: 'layoutCategories',
  header: 'layoutHeader',
  buttons: 'layoutButtons',
  surface: 'layoutSurface',
  density: 'layoutDensity',
}

// By part, as "compact" is both a menu item and a spacing
const VALUE_LABELS: Record<LayoutPart, Record<string, TranslationKey>> = {
  menuItem: { row: 'layoutMenuItemRow', card: 'layoutMenuItemCard', compact: 'layoutMenuItemCompact', hero: 'layoutMenuItemHero' },
  categories: { chips: 'layoutCategoriesChips', tabs: 'layoutCategoriesTabs', rail: 'layoutCategoriesRail' },
  header: { left: 'layoutHeaderLeft', center: 'layoutHeaderCenter', banner: 'layoutHeaderBanner' },
  buttons: { pill: 'layoutButtonsPill', rounded: 'layoutButtonsRounded', square: 'layoutButtonsSquare' },
  surface: { flat: 'layoutSurfaceFlat', outlined: 'layoutSurfaceOutlined', shadow: 'layoutSurfaceShadow' },
  density: { airy: 'layoutDensityAiry', comfortable: 'layoutDensityComfortable', compact: 'layoutDensityCompact' },
}

const STYLE_DEFAULT = '__style__'

/**
 * How the customer app is dressed: one of the styles, picked from a card
 * that sketches it, then single parts dressed otherwise behind "Adjust".
 * Picking a style keeps those parts and every colour and font as they are.
 */
export function StylePicker({
  style,
  layout,
  onStyleChange,
  onLayoutChange,
}: {
  /** The style saved or picked; null for a café that never chose (classic) */
  style: string | null
  layout: LayoutForm
  onStyleChange: (style: StyleKey) => void
  onLayoutChange: (layout: LayoutForm) => void
}) {
  const t = useT()
  const current = styleOf({ style })
  const preset = STYLES[current].layout
  const adjusted = LAYOUT_PARTS.filter(({ part }) => layout[part]).length

  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <Label id='brand-style-label'>{t('brandStyle')}</Label>
        <p className='text-muted-foreground text-xs'>{t('brandStyleHint')}</p>
      </div>
      <div role='radiogroup' aria-labelledby='brand-style-label' className='grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5'>
        {STYLE_KEYS.map((key) => {
          const selected = key === current
          return (
            <button
              key={key}
              type='button'
              role='radio'
              aria-checked={selected}
              onClick={() => onStyleChange(key)}
              className={cn(
                'hover:bg-accent/50 focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg border p-2 text-start transition-colors outline-none focus-visible:ring-[3px]',
                selected && 'border-primary ring-primary ring-1'
              )}
            >
              <StyleSketch style={key} />
              <span className='px-0.5'>
                <span className='block text-sm font-medium'>{t(STYLE_LABELS[key].name)}</span>
                <span className='text-muted-foreground block text-xs leading-snug'>{t(STYLE_LABELS[key].hint)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type='button' variant='ghost' size='sm' className='group -ms-2'>
            <ChevronDown className='me-1 size-4 transition-transform group-data-[state=open]:rotate-180' />
            {t('styleAdjust')}
            {adjusted > 0 && <Badge variant='secondary'>{adjusted}</Badge>}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='space-y-3 pt-3'>
          <p className='text-muted-foreground text-xs'>{t('styleAdjustHint')}</p>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {LAYOUT_PARTS.map(({ part, values }) => (
              <div key={part} className='space-y-1.5'>
                <Label htmlFor={`brand-layout-${part}`} className='text-xs'>
                  {t(PART_LABELS[part])}
                </Label>
                <Select
                  value={layout[part] ?? STYLE_DEFAULT}
                  onValueChange={(v) => onLayoutChange({ ...layout, [part]: v === STYLE_DEFAULT ? null : v })}
                >
                  <SelectTrigger id={`brand-layout-${part}`} className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STYLE_DEFAULT}>
                      {t('styleDefaultValue', { value: t(VALUE_LABELS[part][preset[part]]) })}
                    </SelectItem>
                    {values.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(VALUE_LABELS[part][value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/** A few strokes of each style's menu, in the console's own greys: its gist, not the café's colours. */
function StyleSketch({ style }: { style: StyleKey }) {
  const box = 'flex h-24 w-full flex-col gap-1.5 overflow-hidden rounded-md border p-2'
  const line = 'bg-foreground/25 h-1 rounded-full'
  switch (style) {
    // A thumbnail beside each name, chips above
    case 'classic':
      return (
        <div aria-hidden className={cn(box, 'bg-background')}>
          <div className='flex gap-1'>
            <div className='bg-primary/70 h-2 w-5 rounded-full' />
            <div className='bg-foreground/15 h-2 w-5 rounded-full' />
            <div className='bg-foreground/15 h-2 w-4 rounded-full' />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className='flex items-center gap-1.5 rounded-sm border p-0.5'>
              <div className='bg-foreground/20 size-3.5 shrink-0 rounded-[2px]' />
              <div className='flex-1 space-y-0.5'>
                <div className={cn(line, 'w-3/4')} />
                <div className='bg-foreground/15 h-0.5 w-1/3 rounded-full' />
              </div>
            </div>
          ))}
        </div>
      )
    // Names and prices joined by dots, no photos, the brand centred
    case 'minimal':
      return (
        <div aria-hidden className={cn(box, 'bg-background gap-2 px-3')}>
          <div className='bg-foreground/40 mx-auto h-0.5 w-8 rounded-full' />
          <div className='flex justify-center gap-2 border-b pb-1'>
            <div className='bg-foreground/50 h-0.5 w-4' />
            <div className='bg-foreground/20 h-0.5 w-4' />
            <div className='bg-foreground/20 h-0.5 w-4' />
          </div>
          {['w-8', 'w-10', 'w-6'].map((w) => (
            <div key={w} className='flex items-end gap-1'>
              <div className={cn('bg-foreground/35 h-0.5', w)} />
              <div className='border-foreground/30 flex-1 border-b border-dotted' />
              <div className='bg-foreground/35 h-0.5 w-3' />
            </div>
          ))}
        </div>
      )
    // A big photo and a heavy title under it
    case 'bold':
      return (
        <div aria-hidden className={cn(box, 'bg-background')}>
          <div className='bg-foreground/20 h-10 shrink-0 rounded-md shadow-sm' />
          <div className='bg-foreground/80 h-2 w-3/4 rounded-sm' />
          <div className='flex items-center justify-between'>
            <div className='bg-foreground/20 h-1 w-1/3 rounded-full' />
            <div className='bg-primary/80 h-2.5 w-7 rounded-full' />
          </div>
        </div>
      )
    // A serif heading over photo cards, two by two
    case 'cozy':
      return (
        <div aria-hidden className={cn(box, 'bg-background')}>
          <div className='text-foreground/70 text-[11px] leading-none italic' style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Aa
          </div>
          <div className='grid flex-1 grid-cols-2 gap-1.5'>
            {[0, 1].map((i) => (
              <div key={i} className='flex flex-col gap-1 rounded-md p-0.5 shadow-sm ring-1 ring-black/5'>
                <div className='bg-foreground/20 flex-1 rounded-[4px]' />
                <div className={cn(line, 'w-2/3')} />
              </div>
            ))}
          </div>
        </div>
      )
    // Dark always: cards on a dark page, pill buttons
    case 'night':
      return (
        <div aria-hidden className={cn(box, 'border-zinc-800 bg-zinc-950')}>
          <div className='flex justify-center gap-2 border-b border-zinc-800 pb-1'>
            <div className='h-0.5 w-4 bg-zinc-300' />
            <div className='h-0.5 w-4 bg-zinc-700' />
            <div className='h-0.5 w-4 bg-zinc-700' />
          </div>
          <div className='grid flex-1 grid-cols-2 gap-1.5'>
            {[0, 1].map((i) => (
              <div key={i} className='flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5'>
                <div className='flex-1 rounded-[4px] bg-zinc-700' />
                <div className='flex items-center justify-between'>
                  <div className='h-0.5 w-1/2 rounded-full bg-zinc-500' />
                  <div className='h-1.5 w-3 rounded-full bg-zinc-200' />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
  }
}
