import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getPlaceOptions,
  joinStayMutation,
  scanPlaceOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { PLACE_AVAILABLE, PlaceIcon, STAY_RUNNING } from '@/lib/places'
import { useProfileGate } from '@/components/profile-gate'
import { SignInOptions } from '@/components/sign-in-options'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { HoldSheet } from './hold-sheet'
import { TariffLine } from './place-row'

/**
 * What a timed place's code opens, on the places tab rather than a page of
 * its own (docs/visit-tab.html): a sheet from the bottom, the way holding
 * from the list does. A free place is the hold sheet itself, with the
 * place already chosen. A place with a clock running offers to join it.
 * Signed out, it asks to sign in; already in the party, it just closes.
 */
export function ScanSheet({
  placeId,
  onDone,
}: {
  placeId: number
  /** The scan has been answered, one way or another */
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const placeQuery = useQuery({
    ...getPlaceOptions({ path: { id: placeId } }),
    retry: false,
  })
  const scanQuery = useQuery({
    ...scanPlaceOptions({ path: { id: placeId } }),
    enabled: auth.isAuthenticated,
    retry: false,
  })
  const place = placeQuery.data
  const scan = scanQuery.data

  // Already in the party here: the tab is already their clock
  useEffect(() => {
    if (scan?.isAlreadyMember) {
      toast.info(t('alreadyInSession'))
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.isAlreadyMember])

  useEffect(() => {
    if (placeQuery.isError) {
      toast.error(t('invalidQrCode'))
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery.isError])

  const joinStay = useMutation({
    ...joinStayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      toast.success(t('joinedSession'))
      onDone()
    },
    onError: () => toast.error(t('failedToJoinSession')),
  })

  // One sheet, opened once: nothing shows until the place and, signed in,
  // its status have both answered, or the info sheet would open and give
  // way to the hold sheet a moment later
  // (a status call that fails falls back to what the place itself says)
  const settled =
    place != null &&
    (!auth.isAuthenticated || scan != null || scanQuery.isError)
  if (!settled || scan?.isAlreadyMember) return null

  const running = scan
    ? scan.hasRunningStay
    : Number(place.currentStay?.status) === STAY_RUNNING
  const available =
    Number((scan ?? place).status) === PLACE_AVAILABLE && place.canReserve
  const memberCount = scan?.stay?.memberCount ?? place.currentStay?.memberCount

  // A free place: the hold sheet, with this place chosen
  if (auth.isAuthenticated && available) {
    return (
      <>
        <HoldSheet
          place={place}
          onOpenChange={(open) => {
            if (!open) onDone()
          }}
        />
        {profileGateDialog}
      </>
    )
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onDone()
        }}
      >
        <SheetContent
          side='bottom'
          className='mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
        >
          <div className='bg-muted-foreground mx-auto mb-4 h-1 w-10 rounded-full' />

          <SheetHeader className='p-0 text-start'>
            <SheetTitle className='flex items-center gap-2 pe-8 text-xl font-bold'>
              <PlaceIcon
                kind={Number(place.kind)}
                className='text-primary h-5 w-5'
              />
              {localized(place.name)}
            </SheetTitle>
            <SheetDescription>
              <TariffLine place={place} />
            </SheetDescription>
          </SheetHeader>

          <div className='mt-6 flex flex-col items-center gap-3 text-center'>
            {!auth.isAuthenticated ? (
              <>
                <p className='text-muted-foreground text-sm'>
                  {t('signInPrompt')}
                </p>
                <SignInOptions />
              </>
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
                  className='w-full rounded-pill font-bold'
                  disabled={joinStay.isPending}
                  onClick={async () => {
                    if (!(await ensureProfileComplete())) return
                    joinStay.mutate({ path: { id: placeId } })
                  }}
                >
                  {t('join')}
                </Button>
              </>
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t('roomNotAvailable')}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {profileGateDialog}
    </>
  )
}
