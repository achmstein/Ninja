import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { useBrandLayout } from '@/lib/brand-layout'
import { cn } from '@/lib/utils'
import { InstallBanner } from '@/components/install-banner'
import { MenuBanner } from '@/components/menu-banner'
import { CategoryRail } from '@/components/menu/category-rail'
import { MenuItem, MenuItemSkeleton, menuListClass } from '@/components/menu/item-card'
import { OffersCarousel } from '@/components/menu/offers-carousel'
import type { HomeProps, MenuData } from './use-menu'
import { MenuSearchInput, OrderingPausedNote } from './shared'

/**
 * Today's menu page, as every style before the templates had it: search,
 * the offers, a sticky rail of categories and one long list of sections,
 * each item dressed as the style says.
 */
export function ListHome({ menu, children }: HomeProps) {
  const t = useT()
  const layout = useBrandLayout()
  const variant = layout.menuItem
  const sideRail = layout.categories === 'rail'
  const { sections, orderingEnabled, term } = menu

  const [activeSection, setActiveSection] = useState('')

  // While a click-triggered smooth scroll runs, the spy stays quiet so it
  // can't fight the selection the user just made
  const spyPausedUntil = useRef(0)

  // Scroll-spy for the category rail: the active section is the last one
  // whose top has passed the spy line (just under the sticky rail). This is
  // deterministic — unlike IntersectionObserver's changed-entries callback,
  // it can't land on a neighbor — and at the very bottom of the page the
  // last section wins even when it's too short to ever reach the line.
  useEffect(() => {
    // Just past where a clicked section comes to rest, so it lands past the
    // line and stays selected. Read that off the section rather than repeating
    // it: the resting place is per-breakpoint and carries the safe-area inset
    const spyOffset = () => {
      const first = document.getElementById(sections[0]?.id ?? '')
      const rest = first
        ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0
        : 0
      return rest + 12
    }

    const onScroll = () => {
      if (Date.now() < spyPausedUntil.current) {
        // Still the click's own smooth scroll: keep the pause alive until the
        // events stop, so a clicked section near the bottom stays selected
        // even when the page bottoms out before it reaches the spy line
        spyPausedUntil.current = Math.max(
          spyPausedUntil.current,
          Date.now() + 150
        )
        return
      }
      const doc = document.documentElement
      // scrollY > 0 keeps this from firing on transient short layouts (e.g.
      // the remount right after clearing a search, before images size in)
      if (
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      ) {
        const last = sections[sections.length - 1]
        if (last) setActiveSection(last.id)
        return
      }
      const line = spyOffset()
      let current = sections[0]?.id ?? ''
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) current = section.id
        else break
      }
      setActiveSection(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  const renderRow = (item: MenuData['sections'][number]['items'][number]) => (
    <MenuItem key={String(item.id)} variant={variant} {...menu.itemProps(item)} />
  )

  return (
    <div className='flex flex-col gap-[calc(1rem*var(--space))] p-4'>
      {/* Wide screens show the cover here; a phone has it in its top bar */}
      {layout.header === 'banner' && (
        <MenuBanner className='hidden min-h-52 rounded-3xl md:flex' />
      )}

      {!orderingEnabled && <OrderingPausedNote />}

      <InstallBanner />

      <MenuSearchInput value={menu.search} onChange={menu.setSearch} />

      {menu.isLoading ? (
        <div className={variant === 'row' ? 'flex flex-col' : menuListClass(variant)}>
          {[...Array(8)].map((_, i) => (
            <MenuItemSkeleton key={i} variant={variant} />
          ))}
        </div>
      ) : term ? (
        menu.searchResults.length === 0 ? (
          <p className='text-muted-foreground py-16 text-center'>
            {t('noItemsAvailable')}
          </p>
        ) : (
          <div className={menuListClass(variant)}>
            {menu.searchResults.map(renderRow)}
          </div>
        )
      ) : (
        <>
          <OffersCarousel
            items={menu.offerItems}
            onCustomize={menu.onCustomize}
            orderingEnabled={orderingEnabled}
            photos={variant !== 'compact'}
          />

          {/* Beside a side rail on a wide screen the sections take the
              second column; otherwise this wrapper is not a box at all */}
          <div
            className={cn(
              sideRail
                ? 'flex flex-col gap-[calc(1rem*var(--space))] md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-x-8'
                : 'contents'
            )}
          >
            <CategoryRail
              variant={layout.categories}
              sections={sections}
              activeId={activeSection || sections[0]?.id || ''}
              onSelect={(id) => {
                spyPausedUntil.current = Date.now() + 800
                setActiveSection(id)
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />

            <div
              className={cn(
                sideRail
                  ? 'flex flex-col gap-[calc(1rem*var(--space))] md:col-start-2 md:row-start-1'
                  : 'contents'
              )}
            >
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  // Rest exactly under the sticky rail: its own offset (the
                  // safe-area inset on mobile, the brand's header on desktop) plus
                  // the rail's 3.25rem. The flat 128px this replaces overshot, and
                  // the surplus showed the previous category's last row. Beside a
                  // side rail there is only the header above
                  className={cn(
                    'flex scroll-mt-[calc(env(safe-area-inset-top)_+_3.25rem)] flex-col',
                    sideRail
                      ? 'md:scroll-mt-[calc(var(--header-h)_+_1rem)]'
                      : 'md:scroll-mt-[calc(var(--header-h)_+_3.25rem)]'
                  )}
                >
                  <h2 className='heading pt-2 pb-[calc(0.25rem*var(--space))] text-[calc(1rem*var(--heading-scale))]'>
                    {section.label}
                  </h2>
                  <div className={menuListClass(variant)}>
                    {section.items.map(renderRow)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}

      {children}
    </div>
  )
}
