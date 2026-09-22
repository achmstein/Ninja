import { CircleHelp } from 'lucide-react'
import { useLocalized, useT } from '@/lib/i18n'
import {
  usePlaceStore,
  useSessionPlaceStore,
  type StoredPlace,
} from '@/stores/place-store'
import { Button } from '@/components/ui/button'

/**
 * A table carried over from an earlier session is asked about, not assumed
 * (docs/visit-tab.html): nothing is sent to it until the customer says they
 * are still there, and "no" is the same as leaving it. Scanning any code
 * answers this on its own.
 */
export function StillHereCard({ place }: { place: StoredPlace }) {
  const t = useT()
  const localized = useLocalized()
  const confirm = useSessionPlaceStore((s) => s.confirm)
  const clearPlace = usePlaceStore((s) => s.clearPlace)

  return (
    <div className='bg-card flex flex-col gap-3 rounded-xl border p-4'>
      <div className='flex items-center gap-2'>
        <CircleHelp className='text-primary h-5 w-5 shrink-0' />
        <span className='text-sm font-bold'>
          {t('stillAtTable', { name: localized(place.name) })}
        </span>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Button className='rounded-pill' onClick={() => confirm(place.id)}>
          {t('yesStillHere')}
        </Button>
        <Button variant='outline' className='rounded-pill' onClick={clearPlace}>
          {t('noLeftTable')}
        </Button>
      </div>
    </div>
  )
}
