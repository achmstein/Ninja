import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react'
import { Minus, Plus, UtensilsCrossed, X } from 'lucide-react'
import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap, ease, fade } from '@/lib/motion'
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
import { FLIGHT_SPRING, flightAt, planFlight, type Flight } from './photo-flight'
import { Odometer } from '../ninja/odometer'

export type TuneResult = {
  customizations: CartCustomization[]
  quantity: number
  instructions: string
  unitPrice: number
}

/**
 * A dish opened in place: its photo leaves the dish and becomes the
 * sheet's banner, the sheet coming up round it, and closing takes the photo
 * back to the dish. Only a copy of the photo travels, clipped to a frame
 * that goes from the dish's to the banner's, so it changes its crop rather
 * than stretching; the sheet under it only fades and slides. All of it
 * follows the one spring (`progress`), so it moves as one thing, and none
 * of it renders while it moves. The options come in under the photo, all on
 * the one scroll: the ones that must be answered first, the extras last,
 * every one the same pills, which show what is picked themselves. The
 * choices are the classic item sheet's: the customer's saved picks or the
 * café's defaults, nothing sold out, a required question must be answered;
 * until they are, the button names the one left and goes to it.
 */
export function Tune({
  item,
  from = null,
  canOrder,
  onClose,
  onAdd,
  leaving = false,
}: {
  item: CatalogItemDto
  /** The dish's photo it was opened from: the banner grows out of it and goes back into it; none, the sheet rises in on its own */
  from?: HTMLElement | null
  canOrder: boolean
  onClose: () => void
  onAdd: (result: TuneResult, photo: HTMLElement | null) => void
  /** Added: its photo has taken off to the tray, so it lets go of it and fades instead of going back into the dish */
  leaving?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const reduced = useReducedMotion()
  const sheet = useRef<HTMLDivElement>(null)
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

  // The motion. `progress` is the whole of it, 0 at the dish and 1 open; `planned` changes whenever the
  // flight is measured again (on opening, on closing), so what follows from it is worked out afresh.
  // Each value below reads both every time: motion follows the values read as it renders, and one
  // read only once there was a flight would never be followed
  const progress = useMotionValue(0)
  const planned = useMotionValue(0)
  const flight = useRef<Flight | null>(null)
  const flying = useMotionValue<'visible' | 'hidden'>('hidden')
  const at = () => {
    const p = progress.get()
    planned.get()
    return flight.current ? flightAt(flight.current, p) : null
  }
  const clip = useTransform(() => at()?.clip ?? 'none')
  const photoX = useTransform(() => at()?.x ?? 0)
  const photoY = useTransform(() => at()?.y ?? 0)
  const photoScale = useTransform(() => at()?.scale ?? 1)
  const photoW = useTransform(() => (planned.get(), flight.current?.nw ?? 0))
  const photoH = useTransform(() => (planned.get(), flight.current?.nh ?? 0))
  // The plate's icon rides the middle of the frame (it is 48 px)
  const iconX = useTransform(() => (at()?.cx ?? 0) - 24)
  const iconY = useTransform(() => (at()?.cy ?? 0) - 24)
  // The banner itself shows only once the copy has landed on it; with nothing to grow out of, it fades in with the sheet
  const bannerVisibility = useTransform(() => (flying.get() === 'visible' ? 'hidden' : 'visible'))
  const bannerOpacity = useTransform(() => {
    const p = progress.get()
    planned.get()
    return flight.current ? 1 : Math.min(1, p * 2)
  })
  // The page comes up early, so the photo travels over it; the words and the button after, from a little below
  const veil = useTransform(progress, [0, 0.3], [0, 1])
  const bodyOpacity = useTransform(progress, [0.4, 1], [0, 1])
  const bodyY = useTransform(progress, [0, 1], [reduced ? 0 : 28, 0])
  const footOpacity = useTransform(progress, [0.2, 0.7], [0, 1])
  const footY = useTransform(progress, [0, 1], [reduced ? 0 : 72, 0])
  const closeOpacity = useTransform(progress, [0.6, 1], [0, 1])

  // The dish's own photo is hidden while its copy is out, so there are never two
  const hidden = useRef<HTMLElement | null>(null)
  const hideSource = (el: HTMLElement) => {
    el.style.visibility = 'hidden'
    hidden.current = el
  }
  const showSource = () => {
    if (hidden.current) hidden.current.style.visibility = ''
    hidden.current = null
  }

  const run = useRef<AnimationPlaybackControls | null>(null)
  const closing = useRef(false)
  const [isPresent, safeToRemove] = usePresence()

  // Opening: measured before the first paint, so the copy is over the dish from the first frame
  useLayoutEffect(() => {
    const planned0 = reduced ? null : planFlight(from, photo.current, sheet.current)
    flight.current = planned0
    planned.set(planned.get() + 1)
    if (planned0 && from) {
      flying.set('visible')
      hideSource(from)
    }
    run.current = animate(progress, 1, reduced ? fade : FLIGHT_SPRING)
    run.current.finished.then(() => {
      if (!closing.current) flying.set('hidden')
    })
    return showSource
    // Once, as it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Closing: measured again (the sheet may have scrolled, the dish may have moved), then the same spring back
  useEffect(() => {
    if (isPresent) return
    closing.current = true
    run.current?.stop()
    const el = sheet.current
    if (!el) {
      showSource()
      safeToRemove()
      return
    }
    el.style.pointerEvents = 'none'
    if (leaving) {
      // Its photo is on its way to the tray: the dish is back at once, the sheet fades off it
      showSource()
      run.current = animate(el, { opacity: 0, scale: 0.97 }, { duration: 0.18, ease: ease.exit })
    } else {
      const back = reduced ? null : planFlight(from, photo.current, el)
      flight.current = back
      planned.set(planned.get() + 1)
      if (back) flying.set('visible')
      else showSource()
      run.current = animate(progress, 0, reduced ? fade : FLIGHT_SPRING)
    }
    run.current.finished.then(() => {
      showSource()
      safeToRemove()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  return (
    <div ref={sheet} role='dialog' aria-modal='true' aria-label={localized(item.name)} className='absolute inset-0 z-30 flex flex-col overflow-hidden'>
      <motion.div aria-hidden style={{ opacity: veil }} className='bg-background absolute inset-0' />
      <div className='no-scrollbar relative flex-1 overflow-y-auto overscroll-contain'>
        {/* The banner: a short strip across the top, every dish alike, low enough that the options start on the first screen */}
        <motion.div
          ref={photo}
          style={{ visibility: leaving ? 'hidden' : bannerVisibility, opacity: bannerOpacity }}
          className={cn('relative aspect-[16/7] max-h-[180px] w-full overflow-hidden', !hasPhoto && TONE_CLASS.primary)}
        >
          {hasPhoto ? (
            <img
              src={itemPictureUrl(item.id)}
              alt=''
              draggable={false}
              onError={() => setFailed(true)}
              className={cn('size-full object-cover', soldOut && 'grayscale')}
            />
          ) : (
            // No photo: the plate on the café's colour, as everywhere a dish has none (its name is just below)
            <div className='grid size-full place-items-center'>
              <UtensilsCrossed className='size-12 opacity-50' />
            </div>
          )}
        </motion.div>

        <motion.div style={{ opacity: bodyOpacity, y: bodyY }} className='flex flex-col gap-5 px-5 pt-4 pb-6'>
          <div>
            <h2 className='heading text-headline'>{localized(item.name)}</h2>
            {item.description && <p className='text-muted-foreground text-note mt-1 line-clamp-3'>{localized(item.description)}</p>}
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
                  flash={flash?.index === i ? flash.n : 0}
                  selected={picked(customization)}
                  onPick={(id) => pick(customization, id)}
                />
              ))}

          <div>
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
          </div>
        </motion.div>
      </div>

      {/* The one action: how many, and add at a price that rolls as the choices change; until the answers are in, the one left */}
      <motion.div style={{ opacity: footOpacity, y: footY }} className='bg-background relative flex items-center gap-3 border-t px-4 py-3'>
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

      {/* The photo on its way: a copy, clipped to the frame it is passing through, over everything until it lands */}
      <motion.div
        aria-hidden
        style={{ clipPath: clip, visibility: flying }}
        className={cn('pointer-events-none absolute inset-0 z-10', !hasPhoto && TONE_CLASS.primary)}
      >
        {hasPhoto ? (
          <motion.img
            src={itemPictureUrl(item.id)}
            alt=''
            draggable={false}
            style={{ x: photoX, y: photoY, scale: photoScale, width: photoW, height: photoH, originX: 0, originY: 0 }}
            className={cn('absolute top-0 left-0 max-w-none', soldOut && 'grayscale')}
          />
        ) : (
          <motion.span style={{ x: iconX, y: iconY }} className='absolute top-0 left-0'>
            <UtensilsCrossed className='size-12 opacity-50' />
          </motion.span>
        )}
      </motion.div>

      <motion.button
        type='button'
        onClick={onClose}
        style={{ opacity: closeOpacity }}
        aria-label={t('close')}
        className='absolute end-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm'
      >
        <X className='size-5' />
      </motion.button>
    </div>
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
 * must be answered) over its control. It comes in with the sheet, not on a
 * timing of its own. Sent to by the button, it glows a moment.
 */
const QuestionBlock = forwardRef<
  HTMLFieldSetElement,
  { customization: ItemCustomizationDto; flash: number; selected: number[]; onPick: (optionId: number) => void }
>(function QuestionBlock({ customization, flash, selected, onPick }, ref) {
  const t = useT()
  const localized = useLocalized()
  const unanswered = customization.isRequired && selected.length === 0
  return (
    <fieldset
      ref={ref}
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
    </fieldset>
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

