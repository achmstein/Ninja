import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type PromotionDto } from '@/api/catalog'
import { getLivePromotionOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { useBranchStore } from '@/stores/branch-store'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { pillAction } from '@/components/ui/ninja-sheet'
import { promotionPictureUrl } from '@/components/menu/item-picture'

/** How many promotions the device remembers having shown: older ones are long over */
const KEEP_SEEN = 30

/** The promotions this device has been shown, by their id and picture: a new picture is a new promotion seen afresh */
const useSeen = create<{ seen: string[]; see: (key: string) => void }>()(
  persist(
    (set) => ({
      seen: [],
      see: (key) => set((s) => (s.seen.includes(key) ? s : { seen: [...s.seen, key].slice(-KEEP_SEEN) })),
    }),
    // Where storage is blocked (a private window) the access throws and the store keeps to memory
    { name: 'ninja-promotions-seen', storage: createJSONStorage(() => window.localStorage) }
  )
)

const keyOf = (p: PromotionDto) => `${p.id}:${p.pictureUri ?? ''}`

/**
 * The promotion running now at the customer's branch, if any, and whether
 * this device has been shown it yet. Asked again every couple of minutes and
 * on coming back to the tab: one may start (or end) while the app is open.
 */
export function useLivePromotion(): { promotion: PromotionDto | null; seen: boolean; markSeen: () => void } {
  const branchId = useBranchStore((s) => s.branchId)
  const { data } = useQuery({
    ...getLivePromotionOptions({ query: { branchId } }),
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    // Back on the tab, asked again: one switched off meanwhile goes without a reload
    refetchOnWindowFocus: true,
  })
  // No content when none runs: whatever came back that is not a promotion is none
  const promotion = data && typeof data === 'object' && 'id' in data ? (data as PromotionDto) : null
  const seen = useSeen((s) => (promotion ? s.seen.includes(keyOf(promotion)) : true))
  const see = useSeen((s) => s.see)
  return { promotion, seen, markSeen: () => promotion && see(keyOf(promotion)) }
}

/**
 * The promotion as a sheet out of the dock: its picture, the way the
 * business designed it, and the one button it has (to an item, a category or
 * booking). The headline is its title for a screen reader: it is drawn in
 * the picture.
 */
export function PromoPopup({
  promotion,
  open,
  onOpenChange,
  onGo,
}: {
  promotion: PromotionDto
  open: boolean
  onOpenChange: (open: boolean) => void
  onGo: (promotion: PromotionDto) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const action =
    promotion.link === 'Item' ? t('promoOrderNow') : promotion.link === 'Category' ? t('promoSeeMenu') : promotion.link === 'Book' ? t('promoBookNow') : null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='gap-4 px-3 pb-3'>
        <SheetTitle className='sr-only'>{localized(promotion.headline)}</SheetTitle>
        {promotion.pictureUri && (
          <img
            src={promotionPictureUrl(promotion, 1280)}
            alt=''
            className='aspect-[4/5] max-h-[62svh] w-full rounded-[1.4rem] object-cover'
          />
        )}
        {action && (
          <button
            type='button'
            className={pillAction}
            onClick={() => {
              onOpenChange(false)
              onGo(promotion)
            }}
          >
            {action}
          </button>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** The promotion kept in the top bar once it has been shown: its picture in a small circle, opening it again */
export function PromoChip({ promotion, onOpen }: { promotion: PromotionDto; onOpen: () => void }) {
  const t = useT()
  return (
    <button
      type='button'
      onClick={onOpen}
      aria-label={t('promoShowAgain')}
      className='ring-primary/70 size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform active:scale-95'
    >
      {promotion.pictureUri && <img src={promotionPictureUrl(promotion, 320)} alt='' className='size-full object-cover' />}
    </button>
  )
}
