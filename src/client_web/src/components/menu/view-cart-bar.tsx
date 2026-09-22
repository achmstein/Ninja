import { Link } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'
import { cartCount, cartTotal, useCart } from '@/lib/cart'
import { usePrice, useT } from '@/lib/i18n'

/**
 * The menu screen's "view cart" pill (mobile), fixed above the tab bar.
 * Rendered at the END of the menu list: the in-flow spacer twin reserves
 * exactly the pill's height, so the last menu rows always scroll clear of it.
 */
export function ViewCartBar() {
  const t = useT()
  const price = usePrice()
  const lines = useCart((s) => s.lines)
  const count = cartCount(lines)
  const total = cartTotal(lines)

  if (count === 0) return null

  return (
    <>
      {/* The page already pads for the tab bar (main pb-20 + page p-4);
          this tops it up to the strip's height so the last row scrolls
          fully clear of it */}
      <div className='h-7 md:hidden' aria-hidden />
      {/* Opaque strip above the tab bar, like the app: background + top
          border, 8px visible padding on both sides of the pill. The tab bar
          is exactly h-14, so the strip anchors at its top edge — the extra
          1px overlap (hidden behind the bar) guards against sub-pixel
          seams letting content peek through. */}
      <div className='bg-background fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)-1px)] z-40 mx-auto max-w-lg border-t px-4 pt-2 pb-[calc(0.5rem+1px)] md:hidden'>
        <Link
          to='/cart'
          className='bg-primary text-primary-foreground flex items-center justify-between rounded-pill px-5 py-3 text-sm font-semibold'
        >
          <span className='flex items-center gap-2'>
            <ShoppingBag className='h-4 w-4' />
            {t('viewCart')}
            <span className='bg-primary-foreground/20 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs'>
              {count}
            </span>
          </span>
          <span className='tabular-nums'>{price(total)}</span>
        </Link>
      </div>
    </>
  )
}
