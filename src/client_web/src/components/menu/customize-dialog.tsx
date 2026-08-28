import { toast } from '@/lib/toast'
import { type CatalogItemDto } from '@/api/catalog'
import { useCart } from '@/lib/cart'
import { useLocalized } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImageWithFallback } from '@/components/image-fallback'
import { itemPictureUrl } from './item-card'
import { ItemCustomizeForm } from './item-form'

interface CustomizeDialogProps {
  item: CatalogItemDto | null
  onOpenChange: (open: boolean) => void
}

/** Item detail + customization picker, opened from a menu tile. */
export function CustomizeDialog({ item, onOpenChange }: CustomizeDialogProps) {
  const localized = useLocalized()
  const addToCart = useCart((s) => s.add)

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className='p-0'>
        {item && (
          <>
            {item.pictureUri && (
              <ImageWithFallback
                src={itemPictureUrl(item.id)}
                className='aspect-video w-full'
                fallbackIcon={null}
              />
            )}
            <div className='flex flex-col gap-4 p-4 pt-0'>
              <DialogHeader className='pt-4 text-start'>
                <DialogTitle>{localized(item.name)}</DialogTitle>
                {item.description && (
                  <DialogDescription>
                    {localized(item.description)}
                  </DialogDescription>
                )}
              </DialogHeader>
              <ItemCustomizeForm
                key={String(item.id)}
                item={item}
                onAdd={(customizations, quantity, instructions, unitPrice) => {
                  addToCart({
                    productId: Number(item.id),
                    nameEn: item.name?.en ?? '',
                    nameAr: item.name?.ar ?? '',
                    price: unitPrice,
                    pictureUrl: item.pictureUri
                      ? itemPictureUrl(item.id)
                      : undefined,
                    quantity,
                    specialInstructions: instructions || undefined,
                    customizations,
                  })
                  toast.success(localized(item.name))
                  onOpenChange(false)
                }}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
