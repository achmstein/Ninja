import { useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { useBrand } from '@/lib/brand'
import { useAddressSearch, type PickedPlace } from '@/lib/address-search'
import type { LatLng } from '@/lib/geo'
import { useLanguage, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'

/**
 * A street to type above the map, for a customer who would rather name it
 * than find it: Google's suggestions, from the business's own server, lean
 * toward the branch; picking one flies the map there, and the pin is then
 * put on the door as before. Shown only when the business has address
 * search on; without it the map and the typed address are all there is.
 */
export function AddressSearch({ near, onPick }: { near?: LatLng | null; onPick: (place: PickedPlace) => void }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const on = useBrand()?.maps?.search === true
  const search = useAddressSearch({ near, language, enabled: on })
  const [picking, setPicking] = useState<string | null>(null)
  if (!on) return null

  return (
    <div className='flex flex-col gap-1'>
      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2' />
        <Input
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          placeholder={t('deliverySearchAddress')}
          aria-label={t('deliverySearchAddress')}
          className='ps-9 pe-10'
          maxLength={100}
          autoComplete='off'
          enterKeyHint='search'
          // Enter picks nothing here: it would save the address before the pin is put
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
        {search.searching ? (
          <Loader2 className='text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin' />
        ) : (
          search.text && (
            <button
              type='button'
              onClick={() => search.setText('')}
              className='text-muted-foreground absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center'
              aria-label={t('clear')}
            >
              <X className='size-4' />
            </button>
          )
        )}
      </div>
      {search.suggestions.length > 0 && (
        <ul className='flex flex-col' role='listbox' aria-label={t('deliverySearchAddress')}>
          {search.suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type='button'
                role='option'
                aria-selected={false}
                disabled={picking != null}
                onClick={async () => {
                  setPicking(s.placeId)
                  const place = await search.pick(s)
                  setPicking(null)
                  if (place) onPick(place)
                  else toast.error(t('deliverySearchFailed'))
                }}
                className='flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start'
              >
                {picking === s.placeId ? (
                  <Loader2 className='text-muted-foreground size-4 shrink-0 animate-spin' />
                ) : (
                  <MapPin className='text-muted-foreground size-4 shrink-0' />
                )}
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate text-body font-semibold'>{s.primaryText}</span>
                  {s.secondaryText && <span className='text-muted-foreground truncate text-caption'>{s.secondaryText}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
