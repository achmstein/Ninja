import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { Coffee } from 'lucide-react'
import { getItemOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { useT } from '@/lib/i18n'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { NinjaPage } from '@/components/ninja/page/page'
import { Empty } from '@/components/ninja/page/parts'
import { Tune } from '@/components/menu/tune'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/item/$itemId')({
  component: ItemPage,
})

/**
 * A dish by its link: the menu's own card opened in place, filling the
 * screen as it does over the menu, with its options under the photo and
 * the price rolling on the one button. Added, or closed, it goes back to
 * the menu, where the tray has it.
 */
function ItemPage() {
  const { itemId } = Route.useParams()
  const t = useT()
  const navigate = useNavigate()
  const addToCart = useCart((s) => s.add)
  // As the menu: a branch that has paused ordering shows the dish but will not add it
  const canOrder = useSelectedBranch()?.isOrderingEnabled ?? true

  const { data: item, isLoading } = useQuery(getItemOptions({ path: { id: Number(itemId) } }))

  if (!isLoading && !item) {
    return (
      <NinjaPage title={t('menu')} back='/'>
        <Empty icon={Coffee} title={t('itemNotFound')}>
          <Button className='rounded-full px-8' onClick={() => navigate({ to: '/' })}>
            {t('browseMenu')}
          </Button>
        </Empty>
      </NinjaPage>
    )
  }

  const toMenu = () => navigate({ to: '/' })

  return (
    <MotionConfig reducedMotion='user'>
      {/* Over everything, the dock included, as the card is over the menu */}
      <div className='bg-background fixed inset-0 z-50'>
        <div className='relative mx-auto h-full max-w-lg overflow-hidden'>
          {item ? (
            <Tune
              item={item}
              canOrder={canOrder}
              onClose={toMenu}
              onAdd={(result) => {
                addToCart({
                  productId: Number(item.id),
                  nameEn: item.name?.en ?? '',
                  nameAr: item.name?.ar ?? '',
                  price: result.unitPrice,
                  pictureUrl: item.pictureUri ? itemPictureUrl(item, 320) : undefined,
                  quantity: result.quantity,
                  specialInstructions: result.instructions || undefined,
                  customizations: result.customizations,
                })
                toMenu()
              }}
            />
          ) : (
            <div className='flex flex-col gap-5'>
              <Skeleton className='h-[34svh] max-h-80 w-full rounded-none' />
              <div className='flex flex-col gap-3 px-5'>
                <Skeleton className='h-8 w-2/3' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-12 w-full rounded-2xl' />
              </div>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}
