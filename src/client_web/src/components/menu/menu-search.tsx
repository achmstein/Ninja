import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Search, X } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DishPhoto } from './dish-photo'
import { itemPictureUrl } from './item-picture'
import { OfferPrice } from './offer'
import { SoldOutTag } from './list/dish-parts'
import type { MenuSectionData } from './data/use-menu'

/** Lower case, Arabic without its marks and with one alef and one yaa: "إسبريسو" finds "اسبريسو" */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
}

/** The dishes whose name or description holds every word typed, the ones named so first */
export function searchMenu(
  items: CatalogItemDto[],
  query: string
): CatalogItemDto[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored: { item: CatalogItemDto; score: number }[] = []
  for (const item of items) {
    const name = normalize(`${item.name?.en ?? ''} ${item.name?.ar ?? ''}`)
    const about = normalize(`${item.description?.en ?? ''} ${item.description?.ar ?? ''}`)
    if (!words.every((w) => name.includes(w) || about.includes(w))) continue
    const score = words.reduce((sum, w) => sum + (name.includes(w) ? 2 : 1), 0) + (name.startsWith(words[0]) ? 1 : 0)
    scored.push({ item, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item)
}

/**
 * Search the menu: a round button in the top bar that opens the whole
 * screen to a field and the dishes it finds as it is typed, by name or by
 * what they are, in either language (Arabic as it is really typed, without
 * its marks and with any alef). A dish found opens as it does from the menu.
 */
export function MenuSearch({
  sections,
  onOpen,
}: {
  sections: MenuSectionData[]
  onOpen: (item: CatalogItemDto, from: HTMLElement | null) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  // Each dish once (a dish is in its category, and maybe in the usuals and the popular too), with its category's name
  const { items, categoryOf } = useMemo(() => {
    const seen = new Map<string, CatalogItemDto>()
    const category = new Map<string, string>()
    for (const section of sections) {
      for (const item of section.items) {
        const id = String(item.id)
        if (!seen.has(id)) seen.set(id, item)
        if (section.kind === 'category' && !category.has(id)) category.set(id, section.label)
      }
    }
    return { items: [...seen.values()], categoryOf: category }
  }, [sections])

  const results = useMemo(() => searchMenu(items, query), [items, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label={t('searchMenu')}
        className='bg-muted grid size-10 shrink-0 place-items-center rounded-full active:scale-95 motion-reduce:transform-none'
      >
        <Search className='size-5' />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role='dialog'
            aria-modal='true'
            aria-label={t('searchMenu')}
            className='bg-background fixed inset-0 z-50 flex flex-col'
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onAnimationComplete={() => input.current?.focus()}
          >
            <div className='mx-auto flex w-full max-w-lg items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3'>
              {/* The way back, as every pushed page has it: a round button on the start side */}
              <button
                type='button'
                onClick={close}
                aria-label={t('back')}
                className='bg-muted/80 active:bg-muted -ms-1 grid size-10 shrink-0 place-items-center rounded-full transition-colors'
              >
                <ArrowLeft className='size-5 rtl:rotate-180' />
              </button>
              <div className='bg-muted flex h-12 flex-1 items-center gap-2 rounded-full px-4'>
                <Search className='text-muted-foreground size-5 shrink-0' />
                <input
                  ref={input}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && close()}
                  placeholder={t('searchMenu')}
                  enterKeyHint='search'
                  className='placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none'
                />
                {query && (
                  <button type='button' onClick={() => setQuery('')} aria-label={t('close')} className='text-muted-foreground'>
                    <X className='size-4' />
                  </button>
                )}
              </div>
            </div>

            <div className='mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]'>
              {query.trim() !== '' && results.length === 0 && (
                <p className='text-muted-foreground py-16 text-center text-body'>{t('noDishesFound')}</p>
              )}
              <ul className='grid gap-1'>
                {results.map((item, i) => {
                  const soldOut = item.isAvailable === false
                  return (
                    <motion.li
                      key={String(item.id)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
                    >
                      <button
                        type='button'
                        onClick={(e) => {
                          const from = e.currentTarget.querySelector<HTMLElement>('[data-photo]')
                          close()
                          onOpen(item, from)
                        }}
                        className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-start active:bg-muted', soldOut && 'opacity-75')}
                      >
                        <span data-photo className='size-14 shrink-0 overflow-hidden rounded-xl'>
                          <DishPhoto src={item.pictureUri ? itemPictureUrl(item, 320) : null} />
                        </span>
                        <span className='min-w-0 flex-1'>
                          <span className='block truncate text-name font-semibold'>{localized(item.name)}</span>
                          {categoryOf.get(String(item.id)) && (
                            <span className='text-muted-foreground block truncate text-caption'>{categoryOf.get(String(item.id))}</span>
                          )}
                        </span>
                        {soldOut ? <SoldOutTag className='h-7' /> : <OfferPrice item={item} className='shrink-0' />}
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
