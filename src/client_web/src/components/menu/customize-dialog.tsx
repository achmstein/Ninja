import { useRef } from 'react'
import { XIcon } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { useCart } from '@/lib/cart'
import { useDragToDismiss } from '@/lib/drag-to-dismiss'
import { useLocalized, useT } from '@/lib/i18n'
import {
  Dialog,
  DialogClose,
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
  const t = useT()
  const localized = useLocalized()
  const addToCart = useCart((s) => s.add)

  // App-parity sheet gesture: drag the sheet down to close it (mobile only —
  // the desktop layout is a centered card, not a sheet)
  const contentRef = useRef<HTMLDivElement>(null)
  useDragToDismiss(contentRef, !!item, {
    onDismiss: () => onOpenChange(false),
    enabled: () => !window.matchMedia('(min-width: 768px)').matches,
  })

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        className={
          // Mobile: full-height sheet (base dialog slides up from the bottom);
          // while dragged down the top corners round so it reads as a sheet
          'flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden rounded-none border-0 p-0 pb-0 pt-[env(safe-area-inset-top)] md:pt-0 ' +
          'data-[dragging]:rounded-t-2xl ' +
          // Desktop: centered card (inset-0 + m-auto centers without a
          // transform, so the enter/exit animation still composes cleanly);
          // the big slide gets toned down to a short rise
          'md:inset-0 md:m-auto md:h-auto md:max-h-[85vh] md:w-[calc(100%-4rem)] md:max-w-3xl md:rounded-2xl md:border ' +
          'md:data-[state=open]:slide-in-from-bottom-8 md:data-[state=closed]:slide-out-to-bottom-8'
        }
      >
        {/* Grab handle — signals the sheet drags down to close (mobile only) */}
        <div className='pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 flex justify-center md:hidden'>
          <div className='h-1.5 w-11 rounded-full bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.15)]' />
        </div>
        {/* Scrim-backed close so it stays visible over the item photo and
            clear of the status bar (the base dialog X sat under both) */}
        <DialogClose
          aria-label={t('close')}
          className='absolute end-3 top-[calc(env(safe-area-inset-top)+0.625rem)] z-10 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity hover:opacity-85 md:top-3'
        >
          <XIcon className='size-5' />
        </DialogClose>
        {/* Mobile: ONE scroll surface — image and title scroll away with the
            options (app-style item sheet), the CTA stays pinned via sticky.
            Desktop: static image pane + scrolling details pane, unchanged. */}
        {item && (
          <div className='flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible'>
            {item.pictureUri && (
              <ImageWithFallback
                src={itemPictureUrl(item.id)}
                className='aspect-video w-full shrink-0 object-cover md:aspect-auto md:h-auto md:w-2/5'
                fallbackIcon={null}
              />
            )}
            <div className='flex flex-1 flex-col md:min-h-0'>
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
