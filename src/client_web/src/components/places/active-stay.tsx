import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
import { blurSwap, spring } from '@/lib/motion'
import { useLanguage, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import {
  hasOptions,
  placeKindName,
  stayTakesControllerRequests,
  tariffOptions,
} from '@/lib/places'
import { cn } from '@/lib/utils'
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

/** Full-tab view while the customer's clock runs: the clock as the slab
 *  hero (timer, who is in the room), quick service requests with cooldowns,
 *  and leave (app parity). No tab here: a room's orders stay on the Orders tab, so a
 *  long list never sits next to the clock.
 *  The requests follow what the place can do: a waiter and the bill
 *  anywhere, a controller in a console room, a rate switch where the
 *  tariff has options. */
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

  const since = stay.startedAt
    ? new Date(stay.startedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <NinjaPage title={localized(stay.placeName)} subtitle={since && t('sinceTime', { time: since })}>
      <Rise className='flex flex-col gap-5'>
        <RiseItem>
          <StayClock stay={stay} now={now} selfId={auth.user?.profile?.sub} />
        </RiseItem>

        {/* Quick service requests */}
        <RiseItem className='grid grid-cols-2 gap-3'>
          {quickActions.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              remaining={cooldownRemaining(action.id)}
              pending={pendingId === action.id}
              disabled={pendingId !== null}
              onClick={() => sendRequest(action)}
            />
          ))}
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

/**
 * One request as a lifted tile. After it is sent the icon gives way to the
 * seconds left before it can go again, and a line under it runs down with
 * them, so the wait is seen rather than toasted.
 */
function ActionButton({
  action,
  remaining,
  pending,
  disabled,
  onClick,
}: {
  action: QuickAction
  remaining: number
  pending: boolean
  disabled: boolean
  onClick: () => void
}) {
  const swap = blurSwap(useReducedMotion())
  const Icon = action.icon
  const cooling = remaining > 0
  return (
    <motion.button
      type='button'
      whileTap={cooling || disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={cooling || disabled}
      onClick={onClick}
      className='surface relative flex min-h-28 flex-col items-start justify-between gap-3 overflow-hidden rounded-[1.5rem] p-4 text-start disabled:cursor-default'
    >
      <span
        className={cn(
          'grid size-10 place-items-center rounded-full transition-colors duration-200',
          cooling ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.span key={pending ? 'busy' : cooling ? 'wait' : 'icon'} {...swap} className='grid place-items-center'>
            {pending ? (
              <Loader2 className='size-5 animate-spin' />
            ) : cooling ? (
              <span className='text-sm font-bold tabular-nums'>{remaining}</span>
            ) : (
              <Icon className='size-5' />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={cn('text-sm leading-snug font-semibold', cooling && 'text-muted-foreground')}>{action.label}</span>
      {cooling && (
        <motion.span
          aria-hidden
          className='bg-primary absolute inset-x-0 bottom-0 h-1 origin-left rtl:origin-right'
          initial={{ scaleX: remaining / COOLDOWN_SECONDS }}
          animate={{ scaleX: (remaining - 1) / COOLDOWN_SECONDS }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      )}
    </motion.button>
  )
}
