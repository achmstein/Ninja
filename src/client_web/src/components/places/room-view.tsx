import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Loader2, LogOut } from 'lucide-react'
import { type StayViewModel } from '@/api/spaces'
import { leaveStayMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useSecondTick } from '@/lib/clock'
import { type LiveBills } from '@/lib/live-bills'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { OpenBills } from '@/components/bills/open-bills'
import { StayClock } from './stay-clock'
import { StayRequests } from './stay-requests'

/**
 * The room while the customer's clock runs, as the dock's sheet opens it
 * (from any tab, or from the Book tab's "you're in" card): the clock as the
 * hero with who is in the room, what to ask for (the same tiles as at a
 * table), its bills, and the way out for a member who joined someone
 * else's clock. The Book tab stays the places to book.
 */
export function RoomView({ stay, live, onLeft }: { stay: StayViewModel; live: LiveBills; onLeft: () => void }) {
  const auth = useAuth()
  const now = useSecondTick()
  // Only members who joined someone else's stay can leave it: the owner has no exit, staff end the clock (app parity)
  const canLeave = stay.customerId != null && stay.customerId !== auth.user?.profile?.sub

  return (
    <div className='flex flex-col gap-5'>
      <StayClock stay={stay} now={now} selfId={auth.user?.profile?.sub} />
      <StayRequests stay={stay} />
      <OpenBills live={live} />
      {canLeave && <LeaveStay stay={stay} onLeft={onLeft} />}
    </div>
  )
}

function LeaveStay({ stay, onLeft }: { stay: StayViewModel; onLeft: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const leave = useMutation({
    ...leaveStayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      onLeft()
    },
    onError: () => toast.error(t('failedToLeaveSession')),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          className='bg-destructive/10 text-destructive flex h-12 w-full items-center justify-center gap-2 rounded-full text-body font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none'
          disabled={leave.isPending}
        >
          {leave.isPending ? <Loader2 className='size-4 animate-spin' /> : <LogOut className='size-4 rtl:rotate-180' />}
          {t('leaveSession')}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('leaveRoomQuestion')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive hover:bg-destructive/90 text-white'
            onClick={() => leave.mutate({ path: { id: Number(stay.id) } })}
          >
            {t('leaveSession')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
