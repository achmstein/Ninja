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
  /** Called after the item is actually added (not on plain dismissal). */
  onAdded?: () => void
}

/**
 * Item detail + customization picker, opened from a menu tile.
 *
 * Mobile: a full-height sheet (app parity — the item screen is a full page)
 * with the image on top, scrollable options, and a pinned add-to-cart bar.
 * Desktop: a centered two-pane card — image on the left, details on the right.
 */
export function CustomizeDialog({
  item,
  onOpenChange,
  onAdded,
}: CustomizeDialogProps) {
  const localized = useLocalized()
  const addToCart = useCart((s) => s.add)

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          // Mobile: full-height sheet (base dialog slides up from the bottom)
          'flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden rounded-none border-0 p-0 pb-0 pt-[env(safe-area-inset-top)] md:pt-0 ' +
          // Desktop: centered card (inset-0 + m-auto centers without a
          // transform, so the enter/exit animation still composes cleanly);
          // the big slide gets toned down to a short rise
          'md:inset-0 md:m-auto md:h-auto md:max-h-[85vh] md:w-[calc(100%-4rem)] md:max-w-3xl md:rounded-2xl md:border ' +
          'md:data-[state=open]:slide-in-from-bottom-8 md:data-[state=closed]:slide-out-to-bottom-8'
        }
      >
        {item && (
          <div className='flex min-h-0 flex-1 flex-col md:flex-row'>
            {item.pictureUri && (
              <ImageWithFallback
                src={itemPictureUrl(item.id)}
                className='aspect-video w-full shrink-0 object-cover md:aspect-auto md:h-auto md:w-2/5'
                fallbackIcon={null}
              />
            )}
            <div className='flex min-h-0 flex-1 flex-col'>
              <DialogHeader className='p-4 pb-0 text-start'>
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
                pinnedCta
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
                  onOpenChange(false)
                  onAdded?.()
                }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
