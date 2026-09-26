import { forwardRef, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Minus, Plus, X } from 'lucide-react'
import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap, ease, springOpen } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
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

/**
 * A card opened in place: the card itself grows to fill the Ninja menu (it
 * shares its layout id with the card in the deck, so the photo never leaves
 * the screen) and its options come in under the photo, all on the one
 * scroll: the ones that must be answered first, the extras last, each with
 * the control that suits it. What is chosen gathers under the dish's name
 * as chips, each a way to its question. The choices are the classic item
 * sheet's: the customer's saved picks or the café's defaults, nothing sold
 * out, a required question must be answered; until they are, the button
 * names the one left and goes to it.
 */
export function Tune({
  item,
  tone,
  canOrder,
  onClose,
  onAdd,
  leaving = false,
}: {
  item: CatalogItemDto
  tone: DeckColumn['tone']
  canOrder: boolean
  onClose: () => void
  onAdd: (result: TuneResult, photo: HTMLElement | null) => void
  /** Added: its photo has taken off to the tray, so it lets go of it and fades instead of folding back into the card */
  leaving?: boolean
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
  const scale = sizeScale(item.customizations, selections)
  const soldOut = item.isAvailable === false

  // The questions, all on the one scroll: in the café's order, the ones that must be answered first
  const byOrder = [...(item.customizations ?? [])].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const steps = [...byOrder.filter((c) => c.isRequired), ...byOrder.filter((c) => !c.isRequired)]
  const picked = (c: ItemCustomizationDto) => selections[String(c.id)] ?? []
  const missing = steps.findIndex((c) => c.isRequired && picked(c).length === 0)
  const ready = missing < 0

  // A chip or the button sends the eye to a question: it scrolls into view and glows a moment
  const sections = useRef<Array<HTMLElement | null>>([])
  const [flash, setFlash] = useState<{ index: number; n: number } | null>(null)
  const show = (index: number) => {
    sections.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash((f) => ({ index, n: (f?.n ?? 0) + 1 }))
  }

  const pick = (customization: ItemCustomizationDto, optionId: number) => {
    const key = String(customization.id)
    const current = selections[key] ?? []
    if (customization.allowMultiple) {
      setOverrides({ ...selections, [key]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] })
      return
    }
    // One choice: tapping it again clears it only when the question is optional
    const next = current.includes(optionId) && !customization.isRequired ? [] : [optionId]
    setOverrides({ ...selections, [key]: next })
  }

  return (
    <motion.div
      layoutId={`card-${item.id}`}
      style={{ borderRadius: 0 }}
      transition={springOpen}
      exit={leaving ? { opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: ease.exit } } : undefined}
      role='dialog'
      aria-modal='true'
      aria-label={localized(item.name)}
      className='bg-background absolute inset-0 z-30 flex flex-col overflow-hidden'
    >
      <div className='no-scrollbar flex-1 overflow-y-auto overscroll-contain'>
        {/* The photo keeps its place on screen through the morph; a bigger size draws it a little bigger */}
        <motion.div
          ref={photo}
          layoutId={leaving ? undefined : `photo-${item.id}`}
          transition={springOpen}
          style={{ opacity: leaving ? 0 : undefined }}
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
          transition={{ ...springOpen, delay: 0.06 }}
          className='flex flex-col gap-5 px-5 pt-5 pb-6'
        >
          <div className='flex flex-col gap-2.5'>
            <div>
              <h2 className='heading text-[calc(1.75rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</h2>
              {item.description && <p className='text-muted-foreground mt-1.5 text-sm leading-relaxed'>{localized(item.description)}</p>}
            </div>
            {steps.length > 0 && !loadingPreference && <Recap steps={steps} selections={selections} onJump={show} />}
          </div>

          {loadingPreference
            ? steps.length > 0 && <div className='bg-muted h-40 animate-pulse rounded-[1.5rem] motion-reduce:animate-none' />
            : steps.map((customization, i) => (
                <QuestionBlock
                  key={String(customization.id)}
                  ref={(el) => {
                    sections.current[i] = el
                  }}
                  customization={customization}
                  index={i}
                  flash={flash?.index === i ? flash.n : 0}
                  selected={picked(customization)}
                  onPick={(id) => pick(customization, id)}
                />
              ))}

          <motion.div layout='position' transition={springOpen}>
            {noteOpen ? (
              <input
                autoFocus
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('anySpecialRequestsOptional')}
                className='border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-2xl border px-4 text-sm outline-none focus-visible:ring-[3px]'
              />
            ) : (
              <button type='button' onClick={() => setNoteOpen(true)} className='text-muted-foreground self-start text-sm font-medium underline-offset-4 hover:underline'>
                {t('ninjaAddNote')}
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* The one action: how many, and add at a price that rolls as the choices change; until the answers are in, the one left */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={{ ...springOpen, delay: 0.08 }}
        className='bg-background flex items-center gap-3 border-t px-4 py-3'
      >
        <div className='flex items-center gap-1'>
          <button
            type='button'
            aria-label={t('ninjaLess')}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className='bg-muted grid size-10 place-items-center rounded-full disabled:opacity-40'
            disabled={quantity <= 1}
          >
            <Minus className='size-4' />
          </button>
          <span className='w-7 text-center text-lg font-bold tabular-nums'>{quantity}</span>
          <button type='button' aria-label={t('ninjaMore')} onClick={() => setQuantity((q) => q + 1)} className='bg-muted grid size-10 place-items-center rounded-full'>
            <Plus className='size-4' />
          </button>
        </div>
        <AddButton
          disabled={!canOrder || soldOut || loadingPreference}
          label={soldOut ? t('unavailable') : ready ? t('addToCart') : t('ninjaChoose', { name: localized(steps[missing]?.name) })}
          total={!soldOut && ready ? price(unitPrice * quantity) : null}
          onClick={() => (ready ? onAdd({ customizations: chosen, quantity, instructions: instructions.trim(), unitPrice }, photo.current) : show(missing))}
        />
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

/** The main button: Add at the price, or the question still to answer; its words swap with a short blur */
function AddButton({ disabled, label, total, onClick }: { disabled: boolean; label: string; total: string | null; onClick: () => void }) {
  const swap = blurSwap(useReducedMotion())
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className='bg-primary text-primary-foreground flex h-12 min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden rounded-(--radius-pill) px-4 font-bold whitespace-nowrap transition-transform active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none'
    >
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.span key={label} {...swap} className='truncate'>
          {label}
        </motion.span>
      </AnimatePresence>
      {total && <Odometer value={total} />}
    </button>
  )
}

/** What is chosen so far, as chips under the name: each springs in as it is picked, and a tap goes back to its question */
function Recap({ steps, selections, onJump }: { steps: ItemCustomizationDto[]; selections: Selections; onJump: (index: number) => void }) {
  const localized = useLocalized()
  const chips = steps.flatMap((c, index) =>
    sortedOptions(c)
      .filter((o) => (selections[String(c.id)] ?? []).includes(Number(o.id)))
      .map((o) => ({ key: `${c.id}-${o.id}`, name: localized(o.name), index }))
  )
  return (
    <div className='flex min-h-7 flex-wrap gap-1.5'>
      <AnimatePresence mode='popLayout' initial={false}>
        {chips.map((chip) => (
          <motion.button
            key={chip.key}
            type='button'
            layout='position'
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={springOpen}
            onClick={() => onJump(chip.index)}
            className='bg-muted h-7 rounded-full px-3 text-xs font-semibold'
          >
            {chip.name}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * One question, on the scroll with the others: its name (and whether it
 * must be answered) over its control, rising in a little after the one
 * above it. Sent to by a chip or the button, it glows a moment.
 */
const QuestionBlock = forwardRef<
  HTMLFieldSetElement,
  { customization: ItemCustomizationDto; index: number; flash: number; selected: number[]; onPick: (optionId: number) => void }
>(function QuestionBlock({ customization, index, flash, selected, onPick }, ref) {
  const t = useT()
  const localized = useLocalized()
  const unanswered = customization.isRequired && selected.length === 0
  return (
    <motion.fieldset
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springOpen, delay: 0.1 + index * 0.05 }}
      className='relative flex scroll-mt-24 flex-col gap-3'
    >
      {/* The glow: a ring that lights and fades, keyed so each send lights it again */}
      {flash > 0 && (
        <motion.span
          key={flash}
          aria-hidden
          className='ring-primary pointer-events-none absolute -inset-2 rounded-[1.5rem] ring-2'
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, delay: 0.35, ease: ease.exit }}
        />
      )}
      <legend className='mb-3 flex w-full items-baseline justify-between gap-3'>
        <span className='heading text-[calc(1.15rem*var(--heading-scale))]'>{localized(customization.name)}</span>
        <span className={cn('shrink-0 text-xs font-medium', unanswered ? 'text-destructive' : 'text-muted-foreground')}>
          {customization.isRequired ? t('required') : t('ninjaOptional')}
        </span>
      </legend>
      <Control customization={customization} selected={selected} onPick={onPick} />
    </motion.fieldset>
  )
})

/** Longest name a dial stop holds whole; longer ones make the question big rows instead, where a name has room */
const DIAL_NAME_MAX = 9

function Control({ customization, selected, onPick }: ControlProps) {
  const localized = useLocalized()
  const kind = controlKind(customization)
  const roomy = kind === 'dial' && sortedOptions(customization).some((o) => localized(o.name).length > DIAL_NAME_MAX)
  switch (roomy ? 'chips' : kind) {
    case 'size':
      return <SizeControl customization={customization} selected={selected} onPick={onPick} />
    case 'dial':
      return <DialControl customization={customization} selected={selected} onPick={onPick} />
    default:
      return customization.allowMultiple ? (
        <ExtrasControl customization={customization} selected={selected} onPick={onPick} />
      ) : (
        <PickControl customization={customization} selected={selected} onPick={onPick} />
      )
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

/**
 * Sizes: one cup over them that grows to the size picked, the drink inside
 * rising with it, and the sizes under it, the picked one lit by a highlight
 * that slides between them.
 */
function SizeControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  const options = sortedOptions(customization)
  const index = Math.max(0, options.findIndex((o) => selected.includes(Number(o.id))))
  const share = options.length > 1 ? index / (options.length - 1) : 1
  return (
    <div className='flex flex-col items-center gap-4'>
      {/* The cup: its size and its fill both by transform, so nothing lays out as it grows */}
      <div className='grid h-24 place-items-end' aria-hidden>
        <motion.div
          className='border-foreground/70 relative h-20 w-16 origin-bottom overflow-hidden rounded-t-md rounded-b-[40%] border-[3px]'
          initial={false}
          animate={{ scale: 0.62 + share * 0.38 }}
          transition={springOpen}
        >
          <motion.div
            className='bg-primary absolute inset-x-0 bottom-0 h-full origin-bottom'
            initial={false}
            animate={{ scaleY: selected.length > 0 ? 0.45 + share * 0.4 : 0 }}
            transition={springOpen}
          />
        </motion.div>
      </div>
      <div className='bg-muted flex w-full gap-1 rounded-[1.25rem] p-1' role='radiogroup'>
        {options.map((option) => {
          const id = Number(option.id)
          const on = selected.includes(id)
          const { name, extra } = text(option)
          return (
            <button
              key={id}
              type='button'
              role='radio'
              aria-checked={on}
              disabled={!!option.isOutOfStock}
              onClick={() => onPick(id)}
              className='relative flex min-w-0 flex-1 flex-col items-center rounded-2xl px-2 py-2.5 disabled:opacity-40'
            >
              {on && <motion.span layoutId={`size-${customization.id}`} transition={springOpen} aria-hidden className='bg-background absolute inset-0 rounded-2xl shadow-sm' />}
              <span className='relative text-center text-sm leading-tight font-semibold break-words'>{name}</span>
              {extra && <span className='text-muted-foreground relative text-xs tabular-nums'>{extra}</span>}
            </button>
          )
        })}
      </div>
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
              'relative min-w-0 flex-1 rounded-full px-1 py-3 text-center text-xs leading-tight font-semibold transition-colors duration-200 disabled:opacity-40',
              on ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {on && <motion.span layoutId={`dial-${customization.id}`} transition={springOpen} aria-hidden className='bg-primary absolute inset-0 rounded-full' />}
            <span className='relative line-clamp-2 block break-words'>{name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** One of several (a milk, a sauce): big rows, the picked one lit by a highlight that slides to it and a dot that fills */
function PickControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  return (
    <div className='flex flex-col gap-1.5' role='radiogroup'>
      {sortedOptions(customization).map((option) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name, extra } = text(option)
        return (
          <button
            key={id}
            type='button'
            role='radio'
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            onClick={() => onPick(id)}
            className='bg-muted relative flex min-h-14 items-center gap-3 rounded-[1.25rem] px-4 text-start transition-transform active:scale-[0.98] disabled:opacity-40 motion-reduce:transform-none'
          >
            {on && (
              <motion.span
                layoutId={`pick-${customization.id}`}
                transition={springOpen}
                aria-hidden
                style={{ borderRadius: 20 }}
                className='ring-primary bg-primary/10 absolute inset-0 ring-2'
              />
            )}
            <span className='relative min-w-0 flex-1 py-2 text-[15px] leading-snug font-semibold break-words'>{name}</span>
            {extra && <span className='text-muted-foreground relative shrink-0 text-sm tabular-nums'>{extra}</span>}
            <span className={cn('relative grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200', on ? 'border-primary' : 'border-muted-foreground/40')}>
              <motion.span className='bg-primary size-2.5 rounded-full' initial={false} animate={{ scale: on ? 1 : 0 }} transition={springOpen} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Extras, as many as wanted: chips that fill when picked, with what each adds */
function ExtrasControl({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  return (
    <div className='flex flex-wrap gap-2' role='group'>
      {sortedOptions(customization).map((option) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name, extra } = text(option)
        return (
          <button
            key={id}
            type='button'
            role='checkbox'
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            onClick={() => onPick(id)}
            className={cn(
              'flex min-h-11 max-w-full items-center gap-1.5 rounded-[1.375rem] px-4 py-1.5 text-start text-sm leading-snug font-semibold transition-[background-color,color] duration-200 active:scale-[0.97] disabled:opacity-40 motion-reduce:transform-none',
              on ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            <span className='min-w-0 break-words'>{name}</span>
            {extra && <span className='shrink-0 text-xs tabular-nums opacity-75'>{extra}</span>}
          </button>
        )
      })}
    </div>
  )
}
