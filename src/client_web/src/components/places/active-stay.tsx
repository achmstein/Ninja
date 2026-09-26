import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type StayViewModel } from '@/api/spaces'
import { leaveStayMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
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
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { StayClock } from './stay-clock'
import { StayRequests } from './stay-requests'

/** Full-tab view while the customer's clock runs: the clock as the slab
 *  hero (timer, who is in the room), what to ask for (the same tiles as at
 *  a table, components/places/stay-requests.tsx), and leave (app parity).
 *  The bill is the dock's, not here, so a long list never sits next to the
 *  clock. */
export function ActiveStayView({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const auth = useAuth()
  const queryClient = useQueryClient()

  // Only members who joined someone else's stay can leave it — the owner has
  // no exit; staff end the clock (app parity)
  const canLeave =
    stay.customerId != null && stay.customerId !== auth.user?.profile?.sub

  // 1s clock driving the timer (kept in state so render stays pure)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const leaveStay = useMutation({
    ...leaveStayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    },
    onError: () => toast.error(t('failedToLeaveSession')),
  })

  const since = stay.startedAt
    ? new Date(stay.startedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <NinjaPage title={localized(stay.placeName)} subtitle={since && t('sinceTime', { time: since })}>
      <Rise className='flex flex-col gap-5'>
        <RiseItem>
          <StayClock stay={stay} now={now} selfId={auth.user?.profile?.sub} />
        </RiseItem>

        {/* What to ask for, as at a table */}
        <RiseItem>
          <StayRequests stay={stay} />
        </RiseItem>

        {/* Leave (non-owners only) */}
        {canLeave && (
          <RiseItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type='button'
                  className='bg-destructive/10 text-destructive flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none'
                  disabled={leaveStay.isPending}
                >
                  {leaveStay.isPending ? <Loader2 className='size-4 animate-spin' /> : <LogOut className='size-4 rtl:rotate-180' />}
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
                    onClick={() => leaveStay.mutate({ path: { id: Number(stay.id) } })}
                  >
                    {t('leaveSession')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </RiseItem>
        )}
      </Rise>
    </NinjaPage>
  )
}
