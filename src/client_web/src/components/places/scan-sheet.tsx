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
import { MorphButton } from '@/components/motion/morph-button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { HoldSheet } from './hold-sheet'
import { TariffLine } from './place-card'

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
          className='gap-0 px-2 pb-2'
        >
          {/* The place on its card, as the tab shows it */}
          <SheetHeader className='bg-primary text-primary-foreground relative isolate overflow-hidden rounded-[1.4rem] p-5 text-start'>
            <PlaceIcon kind={Number(place.kind)} className='pointer-events-none absolute -end-6 -bottom-8 -z-10 size-40 -rotate-12 opacity-[0.12]' />
            <SheetTitle className='heading text-primary-foreground pe-8 text-[calc(1.75rem*var(--heading-scale))] leading-tight'>
              {localized(place.name)}
            </SheetTitle>
            <SheetDescription className='text-primary-foreground/80'>
              <TariffLine place={place} />
            </SheetDescription>
            {running && memberCount != null && (
              <span className='bg-primary-foreground/15 mt-1 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold'>
                <Users className='size-3.5' />
                {t('memberCountFormat', { count: Number(memberCount) })}
              </span>
            )}
          </SheetHeader>

          <div className='flex flex-col items-center gap-3 p-3 pt-5 text-center'>
            {!auth.isAuthenticated ? (
              <>
                <p className='text-muted-foreground text-sm'>{t('signInPrompt')}</p>
                <SignInOptions />
              </>
            ) : running ? (
              <MorphButton
                phase={joinStay.isPending ? 'busy' : joinStay.isSuccess ? 'success' : 'idle'}
                height={48}
                className='font-bold'
                onClick={async () => {
                  if (!(await ensureProfileComplete())) return
                  joinStay.mutate({ path: { id: placeId } })
                }}
              >
                {t('join')}
              </MorphButton>
            ) : (
              <p className='text-muted-foreground text-sm'>{t('roomNotAvailable')}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {profileGateDialog}
    </>
  )
}
