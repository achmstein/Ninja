import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import { Minus, Plus, X } from 'lucide-react'
import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-card'
import {
  effectiveBasePrice,
  preferenceSelections,
  selectionsToCustomizations,
  useSavedPreference,
  withoutOutOfStock,
  type Selections,
} from '@/components/menu/item-form'
import { controlKind, sizeScale, sortedOptions, TONE_CLASS, type DeckColumn } from './deck-model'
import { Odometer } from './odometer'

export type TuneResult = {
  customizations: CartCustomization[]
  quantity: number
  instructions: string
  unitPrice: number
}

const SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const

/**
 * A card opened in place: the card itself grows to fill the Counter (it
 * shares its layout id with the card in the deck, so the photo never leaves
 * the screen) and the item's options slide in under the photo, drawn from
 * its real option groups. The choices are the classic item sheet's: the
 * customer's saved picks or the café's defaults, nothing sold out, a required
 * group must be answered.
 */
export function Tune({
  item,
  tone,
  canOrder,
  onClose,
  onAdd,
}: {
  item: CatalogItemDto
  tone: DeckColumn['tone']
  canOrder: boolean
  onClose: () => void
  onAdd: (result: TuneResult, photo: HTMLElement | null) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const photo = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed

  // As the classic sheet: hold the options until a signed-in customer's saved picks are known
  const { data: preference, isLoading: loadingPreference } = useSavedPreference(Number(item.id))
  const [overrides, setOverrides] = useState<Selections | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  const selections = withoutOutOfStock(item.customizations, overrides ?? preferenceSelections(item.customizations, preference))
  const chosen = selectionsToCustomizations(item, selections)
  const unitPrice = effectiveBasePrice(item) + chosen.reduce((sum, c) => sum + c.priceAdjustment, 0)
  const missingRequired = (item.customizations ?? []).some((c) => c.isRequired && (selections[String(c.id)] ?? []).length === 0)
  const scale = sizeScale(item.customizations, selections)
  const soldOut = item.isAvailable === false

  const pick = (customization: ItemCustomizationDto, optionId: number) => {
    const key = String(customization.id)
    const current = selections[key] ?? []
    if (customization.allowMultiple) {
      setOverrides({ ...selections, [key]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] })
      return
    }
    // One choice: tapping it again clears it only when the group is optional
    const next = current.includes(optionId) && !customization.isRequired ? [] : [optionId]
    setOverrides({ ...selections, [key]: next })
  }

  const groups = [...(item.customizations ?? [])].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))

  return (
    <motion.div
      layoutId={`card-${item.id}`}
      style={{ borderRadius: 0 }}
      transition={SPRING}
      role='dialog'
      aria-modal='true'
      aria-label={localized(item.name)}
      className='bg-background absolute inset-0 z-30 flex flex-col overflow-hidden'
    >
      <div className='no-scrollbar flex-1 overflow-y-auto overscroll-contain'>
        {/* The photo keeps its place on screen through the morph; a bigger size draws it a little bigger */}
        <motion.div
          ref={photo}
          layoutId={`photo-${item.id}`}
          transition={SPRING}
          className={cn('relative h-[34svh] max-h-80 overflow-hidden', !hasPhoto && TONE_CLASS[tone])}
        >
          {hasPhoto ? (
            <img
              src={itemPictureUrl(item.id)}
              alt=''
              draggable={false}
              onError={() => setFailed(true)}
              className={cn('size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none', soldOut && 'grayscale')}
              style={{ transform: `scale(${scale})` }}
            />
          ) : (
            <div className='flex size-full items-end p-6 transition-transform duration-500 motion-reduce:transition-none' style={{ transform: `scale(${scale})`, transformOrigin: 'bottom left' }}>
              <span className='heading text-[calc(2.75rem*var(--heading-scale))] leading-[0.95] break-words opacity-90'>{localized(item.name)}</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
          transition={{ ...SPRING, delay: 0.06 }}
          className='flex flex-col gap-6 px-5 pt-5 pb-6'
        >
          <div>
            <h2 className='heading text-[calc(1.75rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</h2>
            {item.description && <p className='text-muted-foreground mt-1.5 text-sm leading-relaxed'>{localized(item.description)}</p>}
          </div>

          {groups.map((customization, i) => (
            <motion.fieldset
              key={String(customization.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.1 + i * 0.05 }}
              className='flex flex-col gap-2.5'
            >
              <legend className='mb-2.5 flex items-baseline gap-2 text-sm font-semibold'>
                {localized(customization.name)}
                {customization.isRequired && <span className='text-destructive text-xs font-medium'>{t('required')}</span>}
              </legend>
              {loadingPreference ? (
                <div className='bg-muted h-12 animate-pulse rounded-2xl motion-reduce:animate-none' />
              ) : (
                <Control customization={customization} selected={selections[String(customization.id)] ?? []} onPick={(id) => pick(customization, id)} />
              )}
            </motion.fieldset>
          ))}

          {noteOpen ? (
            <input
              autoFocus
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t('anySpecialRequestsOptional')}
              className='border-input bg-background focus-visible:ring-ring/50 h-11 rounded-2xl border px-4 text-sm outline-none focus-visible:ring-[3px]'
            />
          ) : (
            <button type='button' onClick={() => setNoteOpen(true)} className='text-muted-foreground self-start text-sm font-medium underline-offset-4 hover:underline'>
              {t('counterAddNote')}
            </button>
          )}
        </motion.div>
      </div>

      {/* The one action: how many, and add at a price that rolls as the choices change */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={{ ...SPRING, delay: 0.08 }}
        className='bg-background flex items-center gap-3 border-t px-4 py-3'
      >
        <div className='flex items-center gap-1'>
          <button
            type='button'
            aria-label={t('counterLess')}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className='bg-muted grid size-10 place-items-center rounded-full disabled:opacity-40'
            disabled={quantity <= 1}
          >
            <Minus className='size-4' />
          </button>
          <span className='w-7 text-center text-lg font-bold tabular-nums'>{quantity}</span>
          <button type='button' aria-label={t('counterMore')} onClick={() => setQuantity((q) => q + 1)} className='bg-muted grid size-10 place-items-center rounded-full'>
            <Plus className='size-4' />
          </button>
        </div>
        <button
          type='button'
          disabled={!canOrder || soldOut || missingRequired || loadingPreference}
          onClick={() => onAdd({ customizations: chosen, quantity, instructions: instructions.trim(), unitPrice }, photo.current)}
          className='bg-primary text-primary-foreground flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-(--radius-pill) px-4 font-bold whitespace-nowrap transition-transform active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none'
        >
          <span>{soldOut ? t('unavailable') : t('addToCart')}</span>
          {!soldOut && <Odometer value={price(unitPrice * quantity)} />}
        </button>
      </motion.div>

      <button
        type='button'
        onClick={onClose}
        aria-label={t('close')}
        className='absolute end-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm'
      >
        <X className='size-5' />
      </button>
    </motion.div>
  )
}

function Control({ customization, selected, onPick }: { customization: ItemCustomizationDto; selected: number[]; onPick: (optionId: number) => void }) {
  switch (controlKind(customization)) {
    case 'size':
      return <SizeControl customization={customization} selected={selected} onPick={onPick} />
    case 'dial':
      return <DialControl customization={customization} selected={selected} onPick={onPick} />
    default:
      return <ChipsControl customization={customization} selected={selected} onPick={onPick} />
  }
}

type ControlProps = { customization: ItemCustomizationDto; selected: number[]; onPick: (optionId: number) => void }

function useOptionText() {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  return (option: NonNullable<ItemCustomizationDto['options']>[number]) => {
    const adjustment = Number(option.priceAdjustment ?? 0)
    return {
      name: localized(option.name),
      extra: option.isOutOfStock ? t('outOfStock') : adjustment > 0 ? `+${price.whole(adjustment)}` : null,
    }
  }
}

/** Sizes as cups that grow: each option's glyph is drawn bigger than the last, the picked one filled. */
function SizeControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  const options = sortedOptions(customization)
  return (
    <div className='flex gap-2.5' role='radiogroup'>
      {options.map((option, i) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name, extra } = text(option)
        const glyph = 18 + i * 7
        return (
          <button
            key={id}
            type='button'
            role='radio'
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            onClick={() => onPick(id)}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl border px-2 pt-3 pb-2.5 transition-colors disabled:opacity-40',
              on ? 'border-primary' : 'border-border'
            )}
          >
            {on && (
              <motion.span
                layoutId={`size-${customization.id}`}
                transition={SPRING}
                aria-hidden
                className='bg-primary/10 absolute inset-0 rounded-2xl'
              />
            )}
            <span className='relative grid h-10 place-items-end'>
              <span
                aria-hidden
                className={cn('block rounded-b-[40%] rounded-t-md border-2 transition-colors', on ? 'bg-primary border-primary' : 'border-muted-foreground/50')}
                style={{ width: glyph, height: glyph * 1.1 }}
              />
            </span>
            <span className='relative text-sm font-semibold'>{name}</span>
            {extra && <span className='text-muted-foreground relative text-xs tabular-nums'>{extra}</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A scale (sugar, roast) as a dial: a track with a stop per option and a
 * thumb that slides to the one picked. Drag along it or tap a stop.
 */
function DialControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  const options = sortedOptions(customization)
  const stops = useRef<Array<HTMLButtonElement | null>>([])
  const dragging = useRef(false)

  const pickAt = (e: ReactPointerEvent) => {
    const index = stops.current.findIndex((el) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right
    })
    const option = options[index]
    if (option && !option.isOutOfStock && !selected.includes(Number(option.id))) onPick(Number(option.id))
  }

  return (
    <div
      role='radiogroup'
      className='bg-muted relative flex touch-pan-y rounded-full p-1 select-none'
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        pickAt(e)
      }}
      onPointerMove={(e) => {
        if (dragging.current) pickAt(e)
      }}
      onPointerUp={() => {
        dragging.current = false
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
    >
      {options.map((option, i) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name } = text(option)
        return (
          <button
            key={id}
            ref={(el) => {
              stops.current[i] = el
            }}
            type='button'
            role='radio'
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            // A finger or a mouse picks on the way down (above); a click with no pointer is the keyboard
            onClick={(e) => {
              if (e.detail === 0 && !on) onPick(id)
            }}
            className={cn(
              'relative min-w-0 flex-1 rounded-full px-1 py-2.5 text-center text-xs font-semibold transition-colors duration-200 disabled:opacity-40',
              on ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {on && <motion.span layoutId={`dial-${customization.id}`} transition={SPRING} aria-hidden className='bg-primary absolute inset-0 rounded-full' />}
            <span className='relative block truncate'>{name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Everything else: chips, filled when picked, with what each adds to the price. */
function ChipsControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  return (
    <div className='flex flex-wrap gap-2' role={customization.allowMultiple ? 'group' : 'radiogroup'}>
      {sortedOptions(customization).map((option) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name, extra } = text(option)
        return (
          <button
            key={id}
            type='button'
            role={customization.allowMultiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            onClick={() => onPick(id)}
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color] duration-200 active:scale-[0.97] disabled:opacity-40 motion-reduce:transform-none',
              on ? 'bg-primary text-primary-foreground border-primary' : 'border-border'
            )}
          >
            {name}
            {extra && <span className='text-xs tabular-nums opacity-75'>{extra}</span>}
          </button>
        )
      })}
    </div>
  )
}
