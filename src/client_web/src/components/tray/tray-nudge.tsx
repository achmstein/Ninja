import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import { create } from 'zustand'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { quickAddChoice } from '../menu/deck/deck-model'
import { DishPhoto } from '../menu/dish-photo'
import { itemPictureUrl } from '../menu/item-picture'
import { effectiveBasePrice } from '../menu/item-form'
import { cartNudge, menuById } from '../menu/paired-items'

/** The suggestions waved away, until the order is sent or emptied; kept while the tray opens and shuts */
const useWavedAway = create<{ ids: ReadonlySet<number>; wave: (id: number) => void; reset: () => void }>((set) => ({
  ids: new Set(),
  wave: (id) => set((s) => ({ ids: new Set([...s.ids, id]) })),
  reset: () => set({ ids: new Set() }),
}))

/**
 * The one thing the order suggests, under its dishes: what goes well with
 * the dish added last ("Add a waffle?"), one tap to add with its defaults,
 * or waved away. Only dishes with nothing to choose are offered here.
 */
export function TrayNudge() {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const lines = useCart((s) => s.lines)
  const add = useCart((s) => s.add)
  const { data: items = [] } = useQuery(listItemsOptions())
  const menu = useMemo(() => menuById(items), [items])
  const { ids: dismissed, wave, reset } = useWavedAway()

  // A new order starts with nothing waved away
  const empty = lines.length === 0
  useEffect(() => {
    if (empty) reset()
  }, [empty, reset])

  const offer = cartNudge(lines, menu, dismissed)

  return (
    <AnimatePresence initial={false}>
      {offer && (
        <motion.div
          key={String(offer.id)}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className='overflow-hidden'
        >
          <div className='border-background/15 mt-2 flex items-center gap-3 rounded-2xl border border-dashed px-2 py-2'>
            <span className='bg-background/10 grid size-10 shrink-0 place-items-center overflow-hidden rounded-full'>
              <DishPhoto src={offer.pictureUri ? itemPictureUrl(offer.id) : null} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block truncate text-note font-semibold'>{t('addSuggestion', { name: localized(offer.name) })}</span>
              <span className='block text-caption tabular-nums opacity-60'>{price(effectiveBasePrice(offer))}</span>
            </span>
            <button
              type='button'
              aria-label={t('notNow')}
              onClick={() => wave(Number(offer.id))}
              className='bg-background/10 grid size-8 place-items-center rounded-full'
            >
              <X className='size-3.5' />
            </button>
            <button
              type='button'
              aria-label={t('addSuggestion', { name: localized(offer.name) })}
              onClick={() => {
                const { customizations, unitPrice } = quickAddChoice(offer)
                add({
                  productId: Number(offer.id),
                  nameEn: offer.name?.en ?? '',
                  nameAr: offer.name?.ar ?? '',
                  price: unitPrice,
                  pictureUrl: offer.pictureUri ? itemPictureUrl(offer.id) : undefined,
                  quantity: 1,
                  customizations,
                  suggestion: 'CartNudge',
                })
              }}
              className='bg-primary text-primary-foreground grid size-8 place-items-center rounded-full'
            >
              <Plus className='size-4' />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
