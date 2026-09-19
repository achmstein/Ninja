import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getPlaceOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { cartHasItems } from '@/lib/cart'
import { useBranchStore } from '@/stores/branch-store'
import { usePlaceStore } from '@/stores/place-store'
import { useT, useLocalized } from '@/lib/i18n'
import { PLACE_TABLE } from '@/lib/places'

export const Route = createFileRoute('/p/$placeId')({
  component: PlaceLinkPage,
})

/**
 * What a place's QR opens: https://chillax.site/p/{id}. It never shows
 * anything itself — a spinner for the moment the place loads — and sends
 * the customer on:
 *
 * - a place that only takes orders is where their order goes: remembered,
 *   and back to the menu (or the cart they were in) with a toast;
 * - a timed place opens the places tab with the hold sheet up, the place
 *   already chosen (docs/visit-tab.html) — or the join, where a clock runs.
 *   Its clock is what makes it theirs; the scan alone claims nothing.
 */
function PlaceLinkPage() {
  const { placeId } = Route.useParams()
  const id = Number(placeId)
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const setPlace = usePlaceStore((s) => s.setPlace)
  const clearPlace = usePlaceStore((s) => s.clearPlace)

  const placeQuery = useQuery({
    ...getPlaceOptions({ path: { id } }),
    retry: false,
  })
  const place = placeQuery.data

  // Only act on the first settled outcome
  const handled = useRef(false)

  const resume = () =>
    navigate({ to: cartHasItems() ? '/cart' : '/', replace: true })

  useEffect(() => {
    if (handled.current || placeQuery.isLoading) return
    handled.current = true

    if (placeQuery.isError || !place) {
      toast.error(t('invalidQrCode'))
      resume()
      return
    }

    if (!place.isActive) {
      clearPlace()
      toast.error(t('tableUnavailable'))
      resume()
      return
    }

    // The QR belongs to a specific branch — switch to it
    if (place.branchId != null && Number(place.branchId) !== branchId) {
      setBranchId(Number(place.branchId))
      queryClient.invalidateQueries()
    }

    // A plain table is theirs by scanning it: where the order goes, and the
    // chip in the bar. A timed one is not — its clock makes it theirs, by
    // the hold or the join the sheet offers next — so scanning alone puts
    // nothing in the chip.
    if (!place.isTimed) {
      if (Number(place.kind) === PLACE_TABLE) {
        setPlace({
          id: Number(place.id),
          kind: Number(place.kind),
          name: { en: place.name?.en ?? '', ar: place.name?.ar },
          branchId: Number(place.branchId),
        })
      }
      toast.info(t('youAreAtTable', { tableName: localized(place.name) }))
      resume()
      return
    }

    // A timed place: the places tab, with its sheet up for this place
    navigate({ to: '/places', search: { scan: id }, replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery.isLoading, placeQuery.isError, place])

  return (
    <div className='flex h-[60svh] items-center justify-center'>
      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
    </div>
  )
}
