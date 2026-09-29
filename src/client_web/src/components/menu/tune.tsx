import { forwardRef, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Minus, Plus, UtensilsCrossed, X } from 'lucide-react'
import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap, ease, springOpen } from '@/lib/motion'
import { revealField } from '@/lib/reveal'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from './item-picture'
import {
  effectiveBasePrice,
  preferenceSelections,
  selectionsToCustomizations,
  useSavedPreference,
  withoutOutOfStock,
  type Selections,
} from './item-form'
import { sortedOptions, TONE_CLASS } from './deck/deck-model'
import { Odometer } from '../ninja/odometer'

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
 * scroll: the ones that must be answered first, the extras last, every one
 * the same pills, which show what is picked themselves. The choices are the classic item
 * sheet's: the customer's saved picks or the café's defaults, nothing sold
 * out, a required question must be answered; until they are, the button
 * names the one left and goes to it.
 */
export function Tune({
  item,
  canOrder,
  onClose,
  onAdd,
  leaving = false,
}: {
  item: CatalogItemDto
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
  const soldOut = item.isAvailable === false

  // The questions, all on the one scroll: in the café's order, the ones that must be answered first
  const byOrder = [...(item.customizations ?? [])].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const steps = [...byOrder.filter((c) => c.isRequired), ...byOrder.filter((c) => !c.isRequired)]
  const picked = (c: ItemCustomizationDto) => selections[String(c.id)] ?? []
  const missing = steps.findIndex((c) => c.isRequired && picked(c).length === 0)
  const ready = missing < 0

  // The button sends the eye to a question still to answer: it scrolls into view and glows a moment
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

  // The photo keeps its place on screen through the morph, whichever way it is laid out
  const compact = steps.length > 0
  const photoBox = (className: string) => (
    <motion.div
      ref={photo}
      layoutId={leaving ? undefined : `photo-${item.id}`}
      transition={springOpen}
      style={{ opacity: leaving ? 0 : undefined }}
      className={cn('relative overflow-hidden', !hasPhoto && TONE_CLASS.primary, className)}
    >
      {hasPhoto ? (
        <img src={itemPictureUrl(item.id)} alt='' draggable={false} onError={() => setFailed(true)} className={cn('size-full object-cover', soldOut && 'grayscale')} />
      ) : (
        // No photo: the plate on the café's colour, as everywhere a dish has none (its name is just beside it)
        <div className='grid size-full place-items-center'>
          <UtensilsCrossed className={compact ? 'size-8 opacity-50' : 'size-16 opacity-50'} />
        </div>
      )}
    </motion.div>
  )

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
        {!compact && <div className='h-[30svh] max-h-72'>{photoBox('size-full')}</div>}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
          transition={{ ...springOpen, delay: 0.06 }}
          className={cn('flex flex-col gap-5 px-5 pb-6', compact ? 'pt-5' : 'pt-4')}
        >
          {compact ? (
            // With questions to answer the photo steps aside, a square beside the name, so the options start
            // on the first screen rather than under a photo to scroll past
            <div className='flex items-center gap-4 pe-12'>
              {photoBox('size-24 shrink-0 rounded-[1.25rem]')}
              <div className='min-w-0'>
                <h2 className='heading text-headline'>{localized(item.name)}</h2>
                {item.description && <p className='text-muted-foreground text-note mt-1 line-clamp-3'>{localized(item.description)}</p>}
              </div>
            </div>
          ) : (
            <div>
              <h2 className='heading text-title'>{localized(item.name)}</h2>
              {item.description && <p className='text-muted-foreground text-note mt-1'>{localized(item.description)}</p>}
            </div>
          )}

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
                onFocus={(e) => revealField(e.currentTarget)}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('anySpecialRequestsOptional')}
                className='border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-[3px]'
              />
            ) : (
              <button type='button' onClick={() => setNoteOpen(true)} className='text-muted-foreground self-start text-note font-medium underline-offset-4 hover:underline'>
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
          <span className='w-7 text-center text-headline font-bold tabular-nums'>{quantity}</span>
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
        className={cn(
          'absolute end-3 top-3 z-10 grid size-10 place-items-center rounded-full',
          compact ? 'bg-muted text-foreground' : 'bg-black/45 text-white backdrop-blur-sm'
        )}
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

/**
 * One question, on the scroll with the others: its name (and whether it
 * must be answered) over its control, rising in a little after the one
 * above it. Sent to by the button, it glows a moment.
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
      className='relative flex scroll-mt-24 flex-col'
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
      <legend className='mb-2.5 flex w-full items-baseline justify-between gap-3'>
        <span className='heading text-name'>{localized(customization.name)}</span>
        <span className={cn('shrink-0 text-caption font-medium', unanswered ? 'text-destructive' : 'text-muted-foreground')}>
          {customization.isRequired ? t('required') : t('ninjaOptional')}
        </span>
      </legend>
      <Control customization={customization} selected={selected} onPick={onPick} />
    </motion.fieldset>
  )
})

/** Every question looks the same, one choice or many: pills that fill when picked */
function Control(props: ControlProps) {
  return <OptionPills {...props} />
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

/** A question's options as pills that fill when picked (one, or as many as wanted), with what each adds; a long name wraps */
function OptionPills({ customization, selected, onPick }: ControlProps) {
  const text = useOptionText()
  const many = !!customization.allowMultiple
  return (
    <div className='flex flex-wrap gap-2' role={many ? 'group' : 'radiogroup'}>
      {sortedOptions(customization).map((option) => {
        const id = Number(option.id)
        const on = selected.includes(id)
        const { name, extra } = text(option)
        return (
          <button
            key={id}
            type='button'
            role={many ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={!!option.isOutOfStock}
            onClick={() => onPick(id)}
            className={cn(
              'text-note flex min-h-10 max-w-full items-center gap-1.5 rounded-[1.25rem] px-3.5 py-1.5 text-start leading-snug font-semibold transition-[background-color,color] duration-200 active:scale-[0.97] disabled:opacity-40 motion-reduce:transform-none',
              on ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            <span className='min-w-0 break-words'>{name}</span>
            {extra && <span className='shrink-0 text-caption tabular-nums opacity-75'>{extra}</span>}
          </button>
        )
      })}
    </div>
  )
}

