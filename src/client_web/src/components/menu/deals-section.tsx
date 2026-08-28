import { useQuery } from '@tanstack/react-query'
import { Package, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getBundlesOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { lineFromBundle, lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/image-fallback'

export function bundlePictureUrl(id: number | string | undefined): string {
  return `/api/catalog/bundles/${id}/pic`
}

/** Bundle deals rail: one tap adds the whole combo to the cart as one line. */
export function DealsSection({ orderingEnabled }: { orderingEnabled: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const { lines, add } = useCart()

  const { data: bundles = [] } = useQuery(getBundlesOptions())

  if (bundles.length === 0) return null

  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-sm font-semibold'>{t('deals')}</h2>
      <div className='no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4'>
        {bundles.map((bundle) => {
          const original = Number(bundle.originalPrice ?? 0)
          const bundlePrice = Number(bundle.bundlePrice ?? 0)
          const line = lineFromBundle(bundle)
          const inCart = lines.find((l) => lineKey(l) === lineKey(line))
          return (
            <div
              key={String(bundle.id)}
              className='bg-card text-card-foreground relative flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-xl border shadow-sm'
            >
              <ImageWithFallback
                src={bundle.pictureUri ? bundlePictureUrl(bundle.id) : null}
                className='aspect-video w-full'
                fallbackIcon={
                  <Package className='text-muted-foreground/40 h-8 w-8' />
                }
              />
              {inCart && (
                <span className='bg-primary text-primary-foreground absolute end-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold'>
                  {inCart.quantity}
                </span>
              )}
              <div className='flex flex-1 flex-col gap-1 p-3'>
                <div className='font-semibold'>{localized(bundle.name)}</div>
                {(bundle.items?.length ?? 0) > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    {t('bundleIncludes')}:{' '}
                    {(bundle.items ?? [])
                      .map(
                        (item) =>
                          `${Number(item.quantity ?? 1)}× ${localized(item.itemName)}`
                      )
                      .join(' · ')}
                  </p>
                )}
                <div className='mt-auto flex items-center justify-between gap-1 pt-1'>
                  <div className='text-sm font-bold'>
                    {price(bundlePrice)}{' '}
                    {original > bundlePrice && (
                      <span className='text-muted-foreground text-xs font-normal line-through'>
                        {price(original)}
                      </span>
                    )}
                  </div>
                  {original > bundlePrice && (
                    <Badge variant='secondary' className='text-[10px]'>
                      -{Math.round((1 - bundlePrice / original) * 100)}%
                    </Badge>
                  )}
                  {orderingEnabled && (
                    <Button
                      size='icon'
                      className='size-6 rounded-full'
                      aria-label={t('addToCart')}
                      onClick={() => {
                        add(line)
                        toast.success(localized(bundle.name))
                      }}
                    >
                      <Plus className='h-3 w-3' />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
