import { useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAddressSearch, type PickedPlace } from '@/lib/address-search'
import { useBrand } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

/**
 * The street the caller names, searched with Google through the business's
 * own server: shown only when the business has Google Maps. A pick hands back
 * its point, which the till's delivery form and the call centre put in their
 * location field, where it is read as a pasted link is.
 */
export function AddressSearchField({ onPick }: { onPick: (place: PickedPlace) => void }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const on = useBrand()?.maps?.search === true
  const search = useAddressSearch({ language, enabled: on })
  const [picking, setPicking] = useState<string | null>(null)
  if (!on) return null
  return (
    <div className='flex flex-col gap-1'>
      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2' aria-hidden />
        <Input
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          placeholder={t('deliverySearchAddress')}
          aria-label={t('deliverySearchAddress')}
          className='h-12 ps-9 text-base'
          maxLength={100}
          autoComplete='off'
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
        {search.searching && <Loader2 className='text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin' aria-hidden />}
      </div>
      {search.suggestions.length > 0 && (
        <ul className='flex flex-col rounded-md border' role='listbox' aria-label={t('deliverySearchAddress')}>
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
                className='hover:bg-muted flex min-h-12 w-full items-center gap-2 px-3 py-2 text-start'
              >
                {picking === s.placeId ? (
                  <Loader2 className='text-muted-foreground size-4 shrink-0 animate-spin' aria-hidden />
                ) : (
                  <MapPin className='text-muted-foreground size-4 shrink-0' aria-hidden />
                )}
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate font-medium'>{s.primaryText}</span>
                  {s.secondaryText && <span className='text-muted-foreground truncate text-sm'>{s.secondaryText}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
