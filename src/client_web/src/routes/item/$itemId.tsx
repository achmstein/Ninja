import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Coffee } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getItemOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { useCart } from '@/lib/cart'
import { useLocalized } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageWithFallback } from '@/components/image-fallback'
import { ItemCustomizeForm } from '@/components/menu/item-form'
import { itemPictureUrl } from '@/components/menu/item-card'

export const Route = createFileRoute('/item/$itemId')({
  component: ItemPage,
})

/** Deep-linkable item page; the menu itself uses the customize dialog. */
function ItemPage() {
  const { itemId } = Route.useParams()
  const navigate = useNavigate()
  const localized = useLocalized()
  const addToCart = useCart((s) => s.add)

  const { data: item, isLoading } = useQuery(
    getItemOptions({ path: { id: Number(itemId) } })
  )

  if (isLoading) {
    return (
      <div className='p-4'>
        <Skeleton className='aspect-square w-full rounded-xl md:aspect-video' />
      </div>
    )
  }

  if (!item) {
    return (
      <div className='text-muted-foreground flex h-[60svh] items-center justify-center'>
        Not found
      </div>
    )
  }

  return (
    <div className='flex flex-col md:flex-row md:gap-6 md:p-4'>
      <div className='relative md:w-1/2'>
        <ImageWithFallback
          src={item.pictureUri ? itemPictureUrl(item.id) : null}
          className='aspect-square w-full md:rounded-xl'
          fallbackIcon={
            <Coffee className='text-muted-foreground/40 h-16 w-16' />
          }
        />
        <Button
          variant='secondary'
          size='icon'
          aria-label='Back'
          className='bg-background/90 absolute start-4 top-4 rounded-full shadow backdrop-blur'
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className='h-5 w-5 rtl:rotate-180' />
        </Button>
      </div>

      <div className='flex flex-col gap-4 p-4 md:w-1/2 md:p-0'>
        <div>
          <h1 className='text-xl font-bold'>{localized(item.name)}</h1>
          {item.description && (
            <p className='text-muted-foreground mt-1 text-sm'>
              {localized(item.description)}
            </p>
          )}
        </div>

        <ItemCustomizeForm
          item={item}
          onAdd={(customizations, quantity, instructions, unitPrice) => {
            addToCart({
              productId: Number(item.id),
              nameEn: item.name?.en ?? '',
              nameAr: item.name?.ar ?? '',
              price: unitPrice,
              pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
              quantity,
              specialInstructions: instructions || undefined,
              customizations,
            })
            toast.success(localized(item.name))
            navigate({ to: '/' })
          }}
        />
      </div>
    </div>
  )
}
