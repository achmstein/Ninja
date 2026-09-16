import {
  Armchair,
  RefreshCw,
  Bell,
  Check,
  DoorOpen,
  Gamepad2,
  Loader2,
  Receipt,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relativeTime } from '@/features/orders/status'
import { useSecondsClock } from '@/features/places/use-places'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import {
  REQUEST_CALL_WAITER,
  REQUEST_CONTROLLER_CHANGE,
  REQUEST_RECEIPT_TO_PAY,
  REQUEST_STATUS_ACKNOWLEDGED,
  REQUEST_SWITCH_TO_MULTI,
  REQUEST_CHANGE_OPTION,
} from './service'
import { useServiceRequests } from './use-service-requests'

const requestIcon: Record<number, LucideIcon> = {
  [REQUEST_CALL_WAITER]: Bell,
  [REQUEST_CONTROLLER_CHANGE]: Gamepad2,
  [REQUEST_RECEIPT_TO_PAY]: Receipt,
  [REQUEST_SWITCH_TO_MULTI]: Users,
  // switch-to-single (5) falls through to the single-player icon
  [REQUEST_CHANGE_OPTION]: RefreshCw,
}

const requestLabelKey: Record<number, TranslationKey> = {
  [REQUEST_CALL_WAITER]: 'requestCallWaiter',
  [REQUEST_CONTROLLER_CHANGE]: 'requestControllerChange',
  [REQUEST_RECEIPT_TO_PAY]: 'requestReceiptToPay',
  [REQUEST_SWITCH_TO_MULTI]: 'requestSwitchToMulti',
  5: 'requestSwitchToSingle',
}

/**
 * Live room requests waiting on staff — call a waiter, change a controller,
 * bring the bill, switch player mode. A strip on the floor, like the pending
 * orders one, gone when nothing is waiting. Acknowledge marks a request seen;
 * Done clears it. The hub's ServiceRequestCreated nudge and a chime bring new
 * ones in (see use-pos-notifications).
 */
export function ServiceRequestsStrip() {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()
  const { requests, isActing, acknowledge, complete } = useServiceRequests()
  const nowMs = useSecondsClock(requests.length > 0)

  if (requests.length === 0) return null

  return (
    <section className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Bell className='size-5 text-amber-600 dark:text-amber-500' />
        <h2 className='text-lg font-semibold'>{t('serviceRequests')}</h2>
        <Badge className='h-6 tabular-nums'>{requests.length}</Badge>
      </div>

      <div className='flex gap-3 overflow-x-auto pb-1'>
        {requests.map((request) => {
          const Icon = requestIcon[request.requestType] ?? User
          const label = requestLabelKey[request.requestType]
          const acked = request.status === REQUEST_STATUS_ACKNOWLEDGED
          // The place is what the request names; a table asks for a waiter
          // or the bill the same way a room does
          const atTable = request.placeKind !== 'Room'
          const PlaceIcon = atTable ? Armchair : DoorOpen
          const room =
            localized(request.placeName) ||
            `${atTable ? t('table') : t('room')} ${request.placeId ?? ''}`
          // A rate change names the option wanted; the two old room types
          // read as before
          const requestText =
            request.requestType === REQUEST_CHANGE_OPTION
              ? t('requestChangeOption', { option: request.optionCode ?? '' })
              : label
                ? t(label)
                : t('requestCallWaiter')
          return (
            <div
              key={request.id}
              className='bg-card text-card-foreground flex w-[280px] shrink-0 flex-col gap-3 rounded-xl border p-3 shadow-xs'
            >
              {/* The room is the headline — it is where staff has to go */}
              <div className='flex items-center gap-3'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10'>
                  <Icon className='size-5 text-amber-600 dark:text-amber-500' />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-1 text-base font-semibold'>
                    <PlaceIcon className='text-muted-foreground size-4 shrink-0' />
                    <span className='truncate'>{room}</span>
                  </div>
                  <div className='text-muted-foreground truncate text-sm'>
                    {requestText} ·{' '}
                    {relativeTime(request.createdAt, nowMs, t, locale)}
                  </div>
                </div>
              </div>

              <div className='flex gap-2'>
                {!acked && (
                  <Button
                    variant='outline'
                    className='h-11 flex-1 gap-2'
                    disabled={isActing}
                    onClick={() => acknowledge(request.id)}
                  >
                    {isActing ? (
                      <Loader2 className='size-5 animate-spin' />
                    ) : (
                      <Check className='size-5' />
                    )}
                    {t('acknowledgeRequest')}
                  </Button>
                )}
                <Button
                  className='h-11 flex-1'
                  disabled={isActing}
                  onClick={() => complete(request.id)}
                >
                  {t('done')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
