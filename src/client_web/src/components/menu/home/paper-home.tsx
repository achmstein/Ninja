import { useEffect } from 'react'
import { ChevronDown, Minus, Plus, Search, X } from 'lucide-react'
import { useBrandName } from '@/lib/brand'
import { useSelectedBranch } from '@/lib/branch'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { InstallBanner } from '@/components/install-banner'
import { useItemActions, type ItemRowProps } from '@/components/menu/item-card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { addStylesheet, usePageMark } from './page-effects'
import { OrderingPausedNote, PlaceChips } from './shared'
import type { HomeProps } from './use-menu'

/** The display serif with its italics (for descriptions), and Amiri for the Arabic display lines. */
const PAPER_FONTS =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..700&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap'

/**
 * Paper: the menu as a café prints it. The name set large in a display
 * serif over a flourish, a discrete contents list to jump by, each section
 * under an ornament with its title in small capitals, and every dish a line
 * of type: the name, a dotted leader, the price, the description in italic
 * under it. No photos. Ink on warm paper by day, chalk on a slate board at
 * night (styles/index.css dresses the page while this is on it). Two
 * columns on a wide screen.
 */
export function PaperHome({ menu, children }: HomeProps) {
  const t = useT()
  const name = useBrandName()
  const localized = useLocalized()
  const branch = useSelectedBranch()
  usePageMark('menu-paper')
  useEffect(() => addStylesheet('home-paper-fonts', PAPER_FONTS), [])

  const specials = menu.offerItems

  const jumpTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className='paper-sheet mx-auto flex w-full max-w-5xl flex-col px-5 pt-4 pb-6 md:px-10 md:pt-10'>
      <PlaceChips className='justify-end' />

      {/* The masthead */}
      <header className='flex flex-col items-center pt-6 pb-8 text-center md:pt-4'>
        <Flourish className='paper-accent h-4 w-28' />
        <h1 className='paper-display mt-4 max-w-full text-[clamp(2.4rem,11vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.01em] text-balance break-words'>
          {name}
        </h1>
        {branch?.name && (
          <p className='paper-italic paper-soft mt-3 text-lg'>{localized(branch.name)}</p>
        )}
        <Rule className='mt-6 w-40' />
      </header>

      {!menu.orderingEnabled && <OrderingPausedNote className='mb-6' />}
      <InstallBanner />

      {/* Search on a ruled line, and the contents beside it */}
      <div className='mx-auto mb-10 flex w-full max-w-xl items-center gap-4'>
        <label className='paper-rule-b flex min-w-0 flex-1 items-center gap-2 py-1.5'>
          <Search className='paper-soft size-4 shrink-0' />
          <input
            className='paper-italic min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[color:var(--ink-soft)]'
            placeholder={t('searchMenu')}
            value={menu.search}
            onChange={(e) => menu.setSearch(e.target.value)}
          />
          {menu.search && (
            <button type='button' aria-label={t('cancel')} onClick={() => menu.setSearch('')}>
              <X className='paper-soft size-4' />
            </button>
          )}
        </label>
        {!menu.term && menu.sections.length > 1 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className='paper-caps flex shrink-0 items-center gap-1 py-1.5 text-sm outline-none'>
              {t('menuContents')}
              <ChevronDown className='size-3.5' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='paper-sheet min-w-52'>
              {specials.length > 0 && (
                <DropdownMenuItem className='paper-display text-base' onClick={() => jumpTo('section-specials')}>
                  {t('specialOffers')}
                </DropdownMenuItem>
              )}
              {menu.sections.map((s) => (
                <DropdownMenuItem key={s.id} className='paper-display text-base' onClick={() => jumpTo(s.id)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {menu.isLoading ? (
        <div className='mx-auto flex w-full max-w-xl flex-col gap-6'>
          {[...Array(6)].map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-5 w-3/5 bg-[color:var(--rule)]' />
              <Skeleton className='h-3 w-4/5 bg-[color:var(--rule)]' />
            </div>
          ))}
        </div>
      ) : menu.term ? (
        menu.searchResults.length === 0 ? (
          <p className='paper-italic paper-soft py-16 text-center text-lg'>{t('noItemsAvailable')}</p>
        ) : (
          <div className='mx-auto w-full max-w-xl'>
            {menu.searchResults.map((item) => (
              <PaperLine key={String(item.id)} {...menu.itemProps(item)} />
            ))}
          </div>
        )
      ) : (
        <>
          {/* Today's specials, boxed as a printed insert */}
          {specials.length > 0 && (
            <section
              id='section-specials'
              className='paper-frame mx-auto mb-12 w-full max-w-xl scroll-mt-24 px-5 pt-5 pb-3 md:px-8'
            >
              <h2 className='paper-caps paper-accent mb-2 text-center text-[calc(1.05rem*var(--heading-scale))]'>
                {t('specialOffers')}
              </h2>
              {specials.map((item) => (
                <PaperLine key={String(item.id)} {...menu.itemProps(item)} />
              ))}
            </section>
          )}

          <div className='gap-16 lg:columns-2 lg:[column-rule:1px_solid_var(--rule)]'>
            {menu.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className='mb-12 break-inside-avoid scroll-mt-[calc(var(--header-h)+1.5rem)]'
              >
                <div className='mb-3 flex flex-col items-center gap-2 text-center'>
                  <Ornament className='paper-accent h-5 w-full max-w-64' />
                  <h2 className='paper-caps text-[calc(1.15rem*var(--heading-scale))]'>{section.label}</h2>
                </div>
                {section.items.map((item) => (
                  <PaperLine key={String(item.id)} {...menu.itemProps(item)} />
                ))}
              </section>
            ))}
          </div>

          <div className='flex justify-center pb-4'>
            <Flourish className='paper-accent h-4 w-20 opacity-70' />
          </div>
        </>
      )}

      {children}
    </div>
  )
}

/** One dish as a line of type: the name, a dotted leader and the price, the description in italic under it, a small "+" at the end. */
function PaperLine({ item, orderingEnabled, onCustomize }: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const actions = useItemActions(item, orderingEnabled, onCustomize)
  const setQuantity = useCart((s) => s.setQuantity)
  const { simpleLine } = actions
  const description = localized(item.description)

  return (
    <div className={cn('flex items-start gap-3 py-2.5', !item.isAvailable && 'opacity-45')}>
      <button type='button' className='min-w-0 flex-1 text-start' onClick={actions.handleOpen}>
        <div className='flex items-baseline gap-2'>
          <span className='paper-display min-w-0 text-[1.1rem] leading-snug font-medium'>{localized(item.name)}</span>
          <span aria-hidden className='paper-leader min-w-6 flex-1' />
          {actions.onOffer && (
            <span className='paper-display paper-soft shrink-0 text-sm tabular-nums line-through decoration-1'>
              {price(item.price)}
            </span>
          )}
          <span className={cn('paper-display shrink-0 text-[1.05rem] tabular-nums', actions.onOffer && 'paper-accent')}>
            {price(actions.effectivePrice)}
          </span>
        </div>
        {(description || !item.isAvailable) && (
          <p className='paper-italic paper-soft mt-0.5 line-clamp-2 pe-10 text-[0.95rem] leading-snug'>
            {item.isAvailable ? description : t('unavailable')}
          </p>
        )}
      </button>

      {actions.canOrder &&
        (simpleLine ? (
          <div className='paper-display mt-0.5 flex shrink-0 items-center gap-1 text-sm'>
            <button
              type='button'
              aria-label='Decrease'
              className='paper-button'
              onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity - 1)}
            >
              <Minus className='size-3' />
            </button>
            <span className='w-5 text-center tabular-nums'>{simpleLine.quantity}</span>
            <button
              type='button'
              aria-label='Increase'
              className='paper-button'
              onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity + 1)}
            >
              <Plus className='size-3' />
            </button>
          </div>
        ) : (
          <button
            type='button'
            aria-label={actions.hasCustomizations ? t('customizable') : t('addToCart')}
            className='paper-button mt-0.5'
            onClick={actions.handleOpen}
          >
            <Plus className='size-3.5' />
          </button>
        ))}
    </div>
  )
}

/** The small flourish over the name and at the foot of the menu. */
function Flourish({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 120 16' fill='none' aria-hidden className={className}>
      <path
        d='M58 8c-6-7-14-7-18-2-3 4 1 8 5 6 3-1.5 2-5-1-4.5M62 8c6-7 14-7 18-2 3 4-1 8-5 6-3-1.5-2-5 1-4.5M40 8H6M80 8h34'
        stroke='currentColor'
        strokeWidth='1'
        strokeLinecap='round'
      />
      <path d='M60 4.5 63.5 8 60 11.5 56.5 8Z' fill='currentColor' />
      <circle cx='3' cy='8' r='1.2' fill='currentColor' />
      <circle cx='117' cy='8' r='1.2' fill='currentColor' />
    </svg>
  )
}

/** A section's ornament: two rules drawn to a curl and a lozenge between them. */
function Ornament({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 240 20' fill='none' aria-hidden className={className} preserveAspectRatio='xMidYMid meet'>
      <path d='M8 10h78M154 10h78' stroke='currentColor' strokeWidth='0.8' />
      <path
        d='M86 10c8 0 12-7 20-7 5 0 7 4 4 6.5M154 10c-8 0-12-7-20-7-5 0-7 4-4 6.5M86 10c8 0 12 7 20 7 5 0 7-4 4-6.5M154 10c-8 0-12 7-20 7-5 0-7-4-4-6.5'
        stroke='currentColor'
        strokeWidth='0.9'
        strokeLinecap='round'
      />
      <path d='M120 5l5 5-5 5-5-5Z' fill='currentColor' />
    </svg>
  )
}

/** A short double rule under the masthead. */
function Rule({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-[3px]', className)}>
      <span className='block h-px bg-[color:var(--ink)] opacity-60' />
      <span className='block h-px bg-[color:var(--ink)] opacity-30' />
    </div>
  )
}
