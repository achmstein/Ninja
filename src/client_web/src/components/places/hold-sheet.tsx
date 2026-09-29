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
        className='gap-0 px-2 pb-2'
      >
        <SheetHeader className='bg-primary text-primary-foreground relative isolate overflow-hidden rounded-[1.4rem] p-5 text-start'>
          <PlaceIcon kind={Number(place.kind)} className='pointer-events-none absolute -end-6 -bottom-8 -z-10 size-40 -rotate-12 opacity-[0.12]' />
          <SheetTitle className='heading text-primary-foreground text-headline pe-8'>
            {t('reserveRoomName', { roomName: localized(place.name) })}
          </SheetTitle>
          <SheetDescription className='text-primary-foreground/80'>
            <TariffLine place={place} />
          </SheetDescription>
          {place.description && <p className='text-primary-foreground/80 text-note'>{localized(place.description)}</p>}
        </SheetHeader>
        <HoldForm place={place} onDone={() => onOpenChange(false)} className='p-3 pt-4' />
      </SheetContent>
    </Sheet>
  )
}
