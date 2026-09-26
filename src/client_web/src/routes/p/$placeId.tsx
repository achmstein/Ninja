import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { QrCode } from 'lucide-react'
import { toast } from '@/lib/toast'
import { springSoft } from '@/lib/motion'
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
 * the customer on. While it loads, the code's glyph with a line sweeping
 * over it, as if still being read — there is no page to put a title on:
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

  return <Reading label={t('loading')} />
}

/** The code's glyph in its tile, a line sweeping down it; still under reduced motion */
function Reading({ label }: { label: string }) {
  const reduced = useReducedMotion()
  return (
    <div role='status' className='flex h-[70svh] flex-col items-center justify-center gap-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springSoft}
        className='bg-foreground text-background relative grid size-24 place-items-center overflow-hidden rounded-[1.75rem] shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)]'
      >
        <QrCode className='size-11' />
        {!reduced && (
          <motion.span
            aria-hidden
            className='bg-background/70 absolute inset-x-3 top-0 h-0.5 rounded-full shadow-[0_0_12px_2px_var(--background)]'
            animate={{ y: [12, 84, 12] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </motion.div>
      <span className='text-muted-foreground text-sm font-medium'>{label}</span>
    </div>
  )
}
