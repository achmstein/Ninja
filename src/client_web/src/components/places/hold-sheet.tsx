import { type PlaceViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HoldForm } from './hold-form'
import { TariffLine } from './place-card'

/**
 * Booking a place whose code was just scanned: the place on a card at the
 * top of the sheet, and the same booking that slides in under a card on the
 * tab. It closes itself once the hold went through or was turned down.
 */
export function HoldSheet({ place, onOpenChange }: { place: PlaceViewModel | null; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const localized = useLocalized()
  if (!place) return null

  return (
    <Sheet open={!!place} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg gap-0 rounded-t-[1.75rem] border-t-0 p-2 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:text-primary-foreground [&>button]:end-5 [&>button]:top-5'
      >
        <SheetHeader className='bg-primary text-primary-foreground relative isolate overflow-hidden rounded-[1.4rem] p-5 text-start'>
          <PlaceIcon kind={Number(place.kind)} className='pointer-events-none absolute -end-6 -bottom-8 -z-10 size-40 -rotate-12 opacity-[0.12]' />
          <div className='bg-primary-foreground/40 mx-auto mb-2 h-1 w-10 rounded-full' />
          <SheetTitle className='heading text-primary-foreground pe-8 text-[calc(1.75rem*var(--heading-scale))] leading-tight'>
            {t('reserveRoomName', { roomName: localized(place.name) })}
          </SheetTitle>
          <SheetDescription className='text-primary-foreground/80'>
            <TariffLine place={place} />
          </SheetDescription>
          {place.description && <p className='text-primary-foreground/80 text-sm'>{localized(place.description)}</p>}
        </SheetHeader>
        <HoldForm place={place} onDone={() => onOpenChange(false)} className='p-3 pt-4' />
      </SheetContent>
    </Sheet>
  )
}
