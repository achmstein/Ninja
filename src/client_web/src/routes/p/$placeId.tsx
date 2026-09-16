import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2, Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type PlaceViewModel } from '@/api/spaces'
import {
  getPlaceOptions,
  joinStayMutation,
  scanPlaceOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import { cartHasItems } from '@/lib/cart'
import { useBranchStore } from '@/stores/branch-store'
import { usePlaceStore } from '@/stores/place-store'
import { useT, useLocalized } from '@/lib/i18n'
import {
  PLACE_AVAILABLE,
  PLACE_TABLE,
  PlaceIcon,
  STAY_RUNNING,
} from '@/lib/places'
import { HoldSheet } from '@/components/places/hold-sheet'
import { TariffLine } from '@/components/places/place-row'
import { useProfileGate } from '@/components/profile-gate'
import { SignInOptions } from '@/components/sign-in-options'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/p/$placeId')({
  component: PlaceLinkPage,
})

/**
 * What a place's QR opens: https://chillax.site/p/{id}. The older stickers
 * (/room/{id}, /table/{id}) resolve into this page.
 *
 * A place that only takes orders is a detour, not a destination: the page
 * remembers where they sit and puts them back where they were, with a
 * toast — a full cart means they were partway through checkout. A timed
 * place is a landing page: join the clock running there, or hold it. A
 * timed table is both: it becomes where their order goes as well.
 */
function PlaceLinkPage() {
  const { placeId } = Route.useParams()
  const id = Number(placeId)
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const setPlace = usePlaceStore((s) => s.setPlace)
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [reservePlace, setReservePlace] = useState<PlaceViewModel | null>(null)

  // Anonymous: what the place is. Signed in: the same plus whether the
  // customer is already in the party on it.
  const placeQuery = useQuery({
    ...getPlaceOptions({ path: { id } }),
    retry: false,
  })
  const scanQuery = useQuery({
    ...scanPlaceOptions({ path: { id } }),
    enabled: auth.isAuthenticated,
    retry: false,
  })
  const place = placeQuery.data
  const scan = scanQuery.data

  // Only act on the first settled outcome; cart edits must not re-run it
  const handled = useRef(false)

  const resume = () =>
    navigate({ to: cartHasItems() ? '/cart' : '/', replace: true })

  useEffect(() => {
    if (handled.current || placeQuery.isLoading) return

    if (placeQuery.isError || !place) {
      handled.current = true
      toast.error(t('invalidQrCode'))
      resume()
      return
    }

    if (!place.isActive) {
      handled.current = true
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

    // A table is where the order goes, clock or no clock
    if (Number(place.kind) === PLACE_TABLE) {
      setPlace({
        id: Number(place.id),
        kind: Number(place.kind),
        name: { en: place.name?.en ?? '', ar: place.name?.ar },
        branchId: Number(place.branchId),
      })
    }

    if (!place.isTimed) {
      handled.current = true
      toast.info(t('youAreAtTable', { tableName: localized(place.name) }))
      resume()
    }
    // A timed place stays on this page: the landing card below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery.isLoading, placeQuery.isError, place])

  // Already in the party here → straight to the clock view
  useEffect(() => {
    if (scan?.isAlreadyMember) {
      toast.info(t('alreadyInSession'))
      navigate({ to: '/places', replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.isAlreadyMember])

  const joinStay = useMutation({
    ...joinStayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      toast.success(t('joinedSession'))
      navigate({ to: '/places', replace: true })
    },
    onError: () => toast.error(t('failedToJoinSession')),
  })

  const handleJoin = async () => {
    if (!(await ensureProfileComplete())) return
    joinStay.mutate({ path: { id } })
  }

  if (placeQuery.isLoading || !place?.isTimed) {
    return (
      <div className='flex h-[60svh] items-center justify-center'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
      </div>
    )
  }

  // The stay on it, from whichever query answered
  const running = scan
    ? scan.hasRunningStay
    : Number(place.currentStay?.status) === STAY_RUNNING
  const available =
    Number((scan ?? place).status) === PLACE_AVAILABLE && place.canReserve
  const memberCount = scan?.stay?.memberCount ?? place.currentStay?.memberCount

  return (
    <div className='flex flex-col gap-4 p-4'>
      <Card className='items-center gap-3 p-6 text-center'>
        <div className='bg-primary/10 flex size-14 items-center justify-center rounded-full'>
          <PlaceIcon
            kind={Number(place.kind)}
            className='text-primary h-7 w-7'
          />
        </div>
        <h1 className='text-xl font-bold'>{localized(place.name)}</h1>
        <p className='text-muted-foreground text-sm'>
          <TariffLine place={place} />
        </p>

        {!auth.isAuthenticated ? (
          <>
            <p className='text-muted-foreground text-sm'>{t('signInPrompt')}</p>
            <SignInOptions />
          </>
        ) : scanQuery.isLoading ? (
          <Skeleton className='h-11 w-full rounded-full' />
        ) : running ? (
          <>
            {memberCount != null && (
              <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                <Users className='h-4 w-4' />
                {t('memberCountFormat', { count: Number(memberCount) })}
              </p>
            )}
            <Button
              size='lg'
              className='w-full rounded-full'
              disabled={joinStay.isPending}
              onClick={handleJoin}
            >
              {t('join')}
            </Button>
          </>
        ) : available ? (
          <Button
            size='lg'
            className='w-full rounded-full'
            onClick={async () => {
              if (!(await ensureProfileComplete())) return
              setReservePlace(place)
            }}
          >
            {t('reserveThisRoom')}
          </Button>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('roomNotAvailable')}
          </p>
        )}
      </Card>

      {/* A table takes orders whatever the clock does */}
      {Number(place.kind) === PLACE_TABLE && (
        <Button variant='ghost' className='rounded-full' onClick={resume}>
          {t('orderHere')}
        </Button>
      )}

      <HoldSheet
        place={reservePlace}
        onOpenChange={(open) => {
          if (!open) setReservePlace(null)
        }}
        onReserved={() => navigate({ to: '/places', replace: true })}
      />
      {profileGateDialog}
    </div>
  )
}
