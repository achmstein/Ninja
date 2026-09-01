import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Gamepad2, Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type RoomViewModel } from '@/api/spaces'
import {
  joinSessionByRoomMutation,
  scanRoomOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { useT, useLocalized } from '@/lib/i18n'
import { ROOM_AVAILABLE } from '@/components/rooms/room-row'
import { ReserveSheet } from '@/components/rooms/reserve-sheet'
import { useProfileGate } from '@/components/profile-gate'
import { SignInOptions } from '@/components/sign-in-options'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/room/$roomId')({
  component: RoomLinkPage,
})

/**
 * The printed room QR encodes https://chillax.site/room/{id}; this route is
 * the web equivalent of the mobile scan flow: join the running session, or
 * reserve the room.
 */
function RoomLinkPage() {
  const { roomId } = Route.useParams()
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [reserveRoom, setReserveRoom] = useState<RoomViewModel | null>(null)

  const scanQuery = useQuery({
    ...scanRoomOptions({ path: { roomId: Number(roomId) } }),
    enabled: auth.isAuthenticated,
    retry: false,
  })
  const scan = scanQuery.data

  // The QR belongs to a specific branch — switch to it
  useEffect(() => {
    if (scan?.branchId != null && Number(scan.branchId) !== branchId) {
      setBranchId(Number(scan.branchId))
      queryClient.invalidateQueries()
    }
  }, [scan?.branchId, branchId, setBranchId, queryClient])

  // Already playing here → straight to the session view
  useEffect(() => {
    if (scan?.isAlreadyMember) {
      toast.info(t('alreadyInSession'))
      navigate({ to: '/rooms', replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.isAlreadyMember])

  const joinSession = useMutation({
    ...joinSessionByRoomMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMySessions' }] })
      toast.success(t('joinedSession'))
      navigate({ to: '/rooms', replace: true })
    },
    onError: () => toast.error(t('failedToJoinSession')),
  })

  const handleJoin = async () => {
    if (!(await ensureProfileComplete())) return
    joinSession.mutate({ path: { roomId: Number(roomId) } })
  }

  if (!auth.isAuthenticated) {
    return (
      <div className='flex h-[70svh] flex-col items-center justify-center gap-4 px-6 text-center'>
        <Gamepad2 className='text-muted-foreground/40 h-10 w-10' />
        <p className='text-muted-foreground'>{t('signInPrompt')}</p>
        <SignInOptions />
      </div>
    )
  }

  if (scanQuery.isLoading) {
    return (
      <div className='p-4'>
        <Skeleton className='h-48 rounded-xl' />
      </div>
    )
  }

  if (scanQuery.isError || !scan) {
    return (
      <div className='text-muted-foreground flex h-[60svh] items-center justify-center px-6 text-center'>
        {t('invalidQrCode')}
      </div>
    )
  }

  const available = Number(scan.displayStatus) === ROOM_AVAILABLE

  return (
    <div className='flex flex-col gap-4 p-4'>
      <Card className='items-center gap-3 p-6 text-center'>
        <div className='bg-primary/10 flex size-14 items-center justify-center rounded-full'>
          <Gamepad2 className='text-primary h-7 w-7' />
        </div>
        <h1 className='text-xl font-bold'>{localized(scan.roomName)}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('dualRateFormat', {
            singleRate: String(Number(scan.singleRate ?? 0)),
            multiRate: String(Number(scan.multiRate ?? 0)),
          })}
        </p>

        {scan.hasActiveSession ? (
          <>
            {scan.sessionPreview?.memberCount != null && (
              <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                <Users className='h-4 w-4' />
                {t('memberCountFormat', {
                  count: Number(scan.sessionPreview.memberCount),
                })}
              </p>
            )}
            <Button
              size='lg'
              className='w-full rounded-full'
              disabled={joinSession.isPending}
              onClick={handleJoin}
            >
              {t('join')}
            </Button>
          </>
        ) : available ? (
          <Button
            size='lg'
            className='w-full rounded-full'
            onClick={() =>
              setReserveRoom({
                id: scan.roomId,
                name: scan.roomName,
                singleRate: scan.singleRate,
                multiRate: scan.multiRate,
                displayStatus: scan.displayStatus,
              })
            }
          >
            {t('reserveThisRoom')}
          </Button>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('roomNotAvailable')}
          </p>
        )}
      </Card>

      <ReserveSheet
        room={reserveRoom}
        onOpenChange={(open) => {
          if (!open) {
            setReserveRoom(null)
            navigate({ to: '/rooms' })
          }
        }}
      />
      {profileGateDialog}
    </div>
  )
}
