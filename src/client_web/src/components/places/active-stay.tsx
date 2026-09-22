import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  CreditCard,
  Gamepad2,
  Loader2,
  LogOut,
  RefreshCw,
  User,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { type StayViewModel } from '@/api/spaces'
import { leaveStayMutation } from '@/api/spaces/@tanstack/react-query.gen'
import {
  createServiceRequest,
  SERVICE_REQUEST,
  type ServiceRequestType,
} from '@/lib/services/notifications'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import {
  hasOptions,
  placeKindName,
  stayTakesControllerRequests,
  tariffOptions,
} from '@/lib/places'
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
import { Button } from '@/components/ui/button'
import { StayClock } from './stay-clock'

const COOLDOWN_SECONDS = 30

type QuickAction = {
  /** One key per action for the cooldown map */
  id: string
  type: ServiceRequestType
  label: string
  success: TranslationKey
  icon: React.ComponentType<{ className?: string }>
  optionCode?: string
}

/** Full-tab view while the customer's clock runs: the clock card (timer,
 *  who is in the room), quick service requests with cooldowns, and leave
 *  (app parity). No tab here: a room's orders stay on the Orders tab, so a
 *  long list never sits next to the clock.
 *  The requests follow what the place can do: a waiter and the bill
 *  anywhere, a controller in a console room, a rate switch where the
 *  tariff has options. */
export function ActiveStayView({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const queryClient = useQueryClient()

  // Only members who joined someone else's stay can leave it — the owner has
  // no exit; staff end the clock (app parity)
  const canLeave =
    stay.customerId != null && stay.customerId !== auth.user?.profile?.sub

  // 1s clock driving the timer + cooldown countdowns (kept in state so render
  // stays pure)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [cooldowns, setCooldowns] = useState<Map<string, number>>(new Map())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const cooldownRemaining = (id: string) =>
    Math.max(0, Math.ceil(((cooldowns.get(id) ?? 0) - now) / 1000))

  const sendRequest = async (action: QuickAction) => {
    if (cooldownRemaining(action.id) > 0) {
      toast.info(t('pleaseWaitBeforeRequest'))
      return
    }
    setPendingId(action.id)
    try {
      await createServiceRequest({
        requestType: action.type,
        placeId: Number(stay.placeId),
        placeKind: placeKindName(Number(stay.placeKind)),
        placeName: stay.placeName ?? {},
        sessionId: Number(stay.id),
        optionCode: action.optionCode,
      })
      setCooldowns((map) =>
        new Map(map).set(action.id, Date.now() + COOLDOWN_SECONDS * 1000),
      )
      toast.success(t(action.success))
    } catch {
      toast.error(t('failedToSendRequest'))
    } finally {
      setPendingId(null)
    }
  }

  const leaveStay = useMutation({
    ...leaveStayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      toast.success(t('leftSession'))
    },
    onError: () => toast.error(t('failedToLeaveSession')),
  })

  const quickActions: QuickAction[] = [
    {
      id: 'waiter',
      type: SERVICE_REQUEST.callWaiter,
      label: t('callWaiter'),
      success: 'waiterNotified',
      icon: User,
    },
    ...(stayTakesControllerRequests(stay)
      ? [
          {
            id: 'controller',
            type: SERVICE_REQUEST.controllerChange,
            label: t('controller'),
            success: 'controllerRequestSent' as const,
            icon: Gamepad2,
          },
        ]
      : []),
    {
      id: 'bill',
      type: SERVICE_REQUEST.receiptToPay,
      label: t('getBill'),
      success: 'billRequestSent',
      icon: CreditCard,
    },
    // Every option of the tariff other than the one running: one button each
    ...(hasOptions(stay.tariff)
      ? tariffOptions(stay.tariff)
          .filter((o) => o.code !== stay.currentOptionCode)
          .map((o) => ({
            id: `option:${o.code}`,
            type: SERVICE_REQUEST.changeOption,
            label: t('switchToOption', { option: localized(o.name) }),
            success: 'switchRequestSent' as const,
            icon: RefreshCw,
            optionCode: o.code,
          }))
      : []),
  ]

  return (
    <div className='flex flex-col gap-4 p-4'>
      <StayClock stay={stay} now={now} selfId={auth.user?.profile?.sub} />

      {/* Quick service requests */}
      <div className='grid grid-cols-2 gap-3'>
        {quickActions.map((action) => {
          const remaining = cooldownRemaining(action.id)
          const Icon = action.icon
          return (
            <Button
              key={action.id}
              variant='outline'
              className='h-auto flex-col gap-1.5 rounded-xl py-4'
              disabled={remaining > 0 || pendingId !== null}
              onClick={() => sendRequest(action)}
            >
              {pendingId === action.id ? (
                <Loader2 className='h-5 w-5 animate-spin' />
              ) : (
                <Icon className='h-5 w-5' />
              )}
              <span className='text-xs font-medium'>
                {action.label}
                {remaining > 0 && ` (${remaining})`}
              </span>
            </Button>
          )
        })}
      </div>

      {/* Leave (non-owners only) */}
      {canLeave && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant='outline'
              size='lg'
              className='text-destructive w-full rounded-pill'
              disabled={leaveStay.isPending}
            >
              <LogOut className='h-4 w-4' />
              {t('leaveSession')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('leaveRoomQuestion')}</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className='bg-destructive text-white hover:bg-destructive/90'
                onClick={() =>
                  leaveStay.mutate({ path: { id: Number(stay.id) } })
                }
              >
                {t('leaveSession')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
