import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Play,
  QrCode,
  Square,
  Star,
  TimerReset,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import { getPlaceStayHistoryOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { placeQrUrl } from '@/lib/qr'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CustomerSearchDialog } from '@/features/accounts/components/customer-search-dialog'
import type { KeycloakUser } from '@/features/accounts/types'
import { PendingOrderCard } from '@/features/orders/components/pending-order-card'
import { formatEgp } from '@/features/orders/status'
import { useOrderActions } from '@/features/orders/use-order-actions'
import {
  elapsedSeconds,
  estimateStayCost,
  findOption,
  formatBillingHours,
  formatClock,
  formatDuration,
  hasOptions,
  isHeld,
  isRunning,
  PLACE_OUT_OF_SERVICE,
  placeStatusConfig,
  STAY_CANCELLED,
  stayBilledHours,
  tariffLine,
  tariffOptions,
} from '../status'
import { useStayActions } from '../use-places'
import { RateOptionToggle } from './rate-option-toggle'

const HISTORY_PAGE = 20

function displayName(user: KeycloakUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || user.username
}

interface PlaceDetailPanelProps {
  place: PlaceViewModel
  /** The held or running stay on the place, if any */
  stay: StayViewModel | undefined
  /** Submitted orders waiting on this place, oldest first */
  orders: OrderSummary[]
  onBack: () => void
  onHold: () => void
  onWalkIn: () => void
  /** A held stay needs a rate picked before its clock starts */
  onStartHeld: (stay: StayViewModel, mode: 'start' | 'confirm') => void
}

/**
 * Right-hand pane of the places master-detail: the place's clock (when it
 * has one) with its controls, the orders waiting on it with Confirm in
 * reach, and its past stays below.
 */
export function PlaceDetailPanel({
  place,
  stay,
  orders,
  onBack,
  onHold,
  onWalkIn,
  onStartHeld,
}: PlaceDetailPanelProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const actions = useStayActions()
  const orderActions = useOrderActions()
  const placeId = Number(place.id)
  const timed = Boolean(place.isTimed)

  // 1s clock for the live timer and the hold countdown
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // The parent keys this panel by place id, so switching places resets this
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE)
  const historyQuery = useQuery({
    ...getPlaceStayHistoryOptions({
      path: { id: placeId },
      query: { limit: historyLimit },
    }),
    enabled: timed,
    placeholderData: keepPreviousData,
  })
  const history = historyQuery.data ?? []

  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingOption, setPendingOption] = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<number | null>(null)
  // Customer picker: names the owner (assign) or adds a member
  const [pickerFor, setPickerFor] = useState<'member' | 'assign' | null>(null)

  const running = isRunning(stay)
  const held = isHeld(stay)
  const outOfService = Number(place.status) === PLACE_OUT_OF_SERVICE
  const placeStatus = placeStatusConfig[Number(place.status ?? 0)]

  const stayId = Number(stay?.id)
  const options = tariffOptions(stay?.tariff)
  const currentOption = stay?.currentOptionCode ?? null
  const estimate = stay && running ? estimateStayCost(stay, now) : null
  const expiresInSeconds =
    stay && held && stay.expiresAt
      ? Math.max(0, (new Date(stay.expiresAt).getTime() - now) / 1000)
      : null

  const copyQrLink = () => {
    navigator.clipboard.writeText(placeQrUrl(placeId))
    toast.success(t('placeLinkCopied'))
  }

  const confirmArrival = () => {
    if (!stay) return
    // The customer asked for the clock to start the moment the counter
    // confirms they arrived: with a rate to pick, ask first
    if (stay.startOnConfirm && hasOptions(stay.tariff)) {
      onStartHeld(stay, 'confirm')
    } else {
      actions.confirm(stayId, null, Boolean(stay.startOnConfirm))
    }
  }

  const startHeld = () => {
    if (!stay) return
    if (hasOptions(stay.tariff)) onStartHeld(stay, 'start')
    else actions.startHeld(stayId, null)
  }

  const members = stay?.members ?? []

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex flex-none items-center justify-between gap-2 border-b p-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button
            size='icon'
            variant='ghost'
            className='-ms-2 sm:hidden'
            onClick={onBack}
            aria-label={t('goBack')}
          >
            <ArrowLeft className='rtl:rotate-180' />
          </Button>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${placeStatus?.dotClass ?? 'bg-muted'}`}
          />
          <div className='min-w-0'>
            <h2 className='truncate text-sm font-semibold'>
              {localized(place.name)}
            </h2>
            <p className='text-muted-foreground truncate text-xs tabular-nums'>
              {tariffLine(place, t, localized)}
            </p>
          </div>
        </div>
        <Button
          size='icon'
          variant='ghost'
          onClick={copyQrLink}
          aria-label={t('copyPlaceLink')}
        >
          <QrCode className='h-4 w-4' />
        </Button>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        {/* Now: the clock and its controls */}
        {timed && (
          <div className='border-b'>
            {stay && running ? (
              <div className='flex flex-col items-center gap-4 px-4 py-6'>
                <span className='font-mono text-5xl font-light tracking-widest tabular-nums'>
                  {formatClock(elapsedSeconds(stay, now))}
                </span>
                {currentOption && (
                  <p className='text-muted-foreground text-sm'>
                    {localized(
                      findOption(stay.tariff, currentOption)?.name ??
                        stay.currentOptionName
                    )}
                  </p>
                )}

                {hasOptions(stay.tariff) && (
                  <RateOptionToggle
                    className='w-full max-w-xs'
                    options={options}
                    value={currentOption}
                    onChange={(code) => {
                      if (code !== currentOption) setPendingOption(code)
                    }}
                    disabled={actions.isBusy}
                  />
                )}

                {members.length > 0 ? (
                  <div className='flex flex-wrap items-center justify-center gap-2'>
                    {members.map((member) => {
                      const isOwner = member.role === 'Owner'
                      return (
                        <Badge
                          key={member.customerId}
                          variant='outline'
                          className='gap-1.5 py-1'
                        >
                          {isOwner ? (
                            <Star className='h-3 w-3 fill-amber-400 text-amber-400' />
                          ) : (
                            <User className='h-3 w-3' />
                          )}
                          {member.customerName || t('guest')}
                          {!isOwner && (
                            <button
                              type='button'
                              aria-label={t('memberRemove')}
                              disabled={actions.isBusy}
                              onClick={() =>
                                actions.removeMember(stayId, member.customerId!)
                              }
                            >
                              <X className='text-muted-foreground hover:text-destructive h-3 w-3' />
                            </button>
                          )}
                        </Badge>
                      )
                    })}
                    {/* Compact inline add so it reads as part of the chip row */}
                    <button
                      type='button'
                      disabled={actions.isBusy}
                      onClick={() => setPickerFor('member')}
                      className='text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50'
                    >
                      <UserPlus className='h-3 w-3' />
                      {t('add')}
                    </button>
                  </div>
                ) : (
                  <>
                    {stay.customerName && (
                      <p className='text-muted-foreground flex items-center gap-1 text-sm'>
                        <User className='h-3.5 w-3.5' />
                        {stay.customerName}
                      </p>
                    )}
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={actions.isBusy}
                      onClick={() =>
                        setPickerFor(stay.customerId ? 'member' : 'assign')
                      }
                    >
                      <UserPlus className='me-1 h-4 w-4' />
                      {t(stay.customerId ? 'addCustomer' : 'assignCustomer')}
                    </Button>
                  </>
                )}

                {/* What the bill would say if the clock stopped now: time
                    per rate, rounded the way the server rounds */}
                {estimate && estimate.hours > 0 && (
                  <div className='w-full max-w-xs space-y-1 rounded-lg border p-3 text-sm'>
                    {estimate.lines
                      .filter((line) => line.hours > 0)
                      .map((line) => (
                        <div key={line.code} className='flex justify-between'>
                          <span className='text-muted-foreground'>
                            {localized(line.name)}
                          </span>
                          <span className='tabular-nums'>
                            {formatBillingHours(line.hours, t)} ·{' '}
                            {formatEgp(line.amount)}
                          </span>
                        </div>
                      ))}
                    <Separator className='my-2' />
                    <div className='flex justify-between font-semibold'>
                      <span>{t('estimate')}</span>
                      <span className='tabular-nums'>
                        {formatEgp(estimate.amount)}
                      </span>
                    </div>
                  </div>
                )}

                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    disabled={actions.isBusy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    <X className='me-1 h-4 w-4' />
                    {t('cancelTime')}
                  </Button>
                  <Button
                    variant='destructive'
                    disabled={actions.isBusy}
                    onClick={() => setConfirmEnd(true)}
                  >
                    <Square className='me-1 h-4 w-4' />
                    {t('end')}
                  </Button>
                </div>
              </div>
            ) : stay && held ? (
              <div className='flex flex-col items-center gap-3 px-4 py-8'>
                <div className='flex size-16 items-center justify-center rounded-full bg-amber-500/10'>
                  <Clock className='size-7 text-amber-500' />
                </div>
                <p className='font-medium'>
                  {stay.customerName
                    ? t('heldFor', { name: stay.customerName })
                    : t('held')}
                </p>
                {!stay.customerId && (
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={actions.isBusy}
                    onClick={() => setPickerFor('assign')}
                  >
                    <UserPlus className='me-1 h-4 w-4' />
                    {t('assignCustomer')}
                  </Button>
                )}
                {expiresInSeconds != null && (
                  <p className='font-mono text-sm text-amber-600 tabular-nums dark:text-amber-500'>
                    {t('expiresIn', {
                      countdown: formatClock(expiresInSeconds).slice(3),
                    })}
                  </p>
                )}
                {stay.startOnConfirm && (
                  <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                    <TimerReset className='size-4' />
                    {t('startsOnConfirm')}
                  </p>
                )}
                <div className='mt-2 flex flex-wrap justify-center gap-2'>
                  <Button
                    variant='outline'
                    disabled={actions.isBusy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    <X className='me-1 h-4 w-4' />
                    {t('cancel')}
                  </Button>
                  <Button
                    variant={stay.startOnConfirm ? 'default' : 'outline'}
                    disabled={actions.isBusy}
                    onClick={confirmArrival}
                  >
                    <CheckCircle2 className='me-1 h-4 w-4' />
                    {t('confirm')}
                  </Button>
                  {!stay.startOnConfirm && (
                    <Button disabled={actions.isBusy} onClick={startHeld}>
                      <Play className='me-1 h-4 w-4 rtl:rotate-180' />
                      {t('start')}
                    </Button>
                  )}
                </div>
              </div>
            ) : outOfService ? (
              <div className='flex flex-col items-center gap-3 px-4 py-8'>
                <div className='bg-muted flex size-16 items-center justify-center rounded-full'>
                  <Wrench className='text-muted-foreground size-7' />
                </div>
                <p className='text-muted-foreground font-medium'>
                  {t('outOfService')}
                </p>
              </div>
            ) : (
              <div className='flex flex-col items-center gap-3 px-4 py-8'>
                <div className='flex size-16 items-center justify-center rounded-full bg-green-500/10'>
                  <CheckCircle2 className='size-7 text-green-500' />
                </div>
                <p className='font-medium'>{t('available')}</p>
                {place.description && localized(place.description) && (
                  <p className='text-muted-foreground max-w-sm text-center text-sm'>
                    {localized(place.description)}
                  </p>
                )}
                <div className='mt-2 flex gap-2'>
                  <Button variant='outline' onClick={onHold}>
                    <CalendarClock className='me-1 h-4 w-4' />
                    {t('hold')}
                  </Button>
                  <Button onClick={onWalkIn}>
                    <Play className='me-1 h-4 w-4 rtl:rotate-180' />
                    {t('walkIn')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Orders waiting on the place, with Confirm in reach */}
        {(orders.length > 0 || !timed) && (
          <div className='space-y-3 border-b p-4'>
            <h3 className='text-sm font-medium'>
              {t('pendingOrders')}
              {orders.length > 0 && (
                <span className='text-muted-foreground ms-2 font-normal tabular-nums'>
                  {orders.length}
                </span>
              )}
            </h3>
            {orders.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('noOrdersForTable')}
              </p>
            ) : (
              orders.map((order) => (
                <PendingOrderCard
                  key={String(order.orderNumber)}
                  summary={order}
                  nowMs={now}
                  onConfirm={() =>
                    orderActions.confirm(Number(order.orderNumber))
                  }
                  onCancel={() => setCancelOrder(Number(order.orderNumber))}
                  isActing={
                    Number(orderActions.actingOrderNumber) ===
                    Number(order.orderNumber)
                  }
                />
              ))
            )}
          </div>
        )}

        {/* Past stays */}
        {timed && (
          <div className='p-4'>
            <h3 className='pb-1 text-sm font-medium'>{t('history')}</h3>
            {historyQuery.isLoading ? (
              <p className='text-muted-foreground py-4 text-sm'>
                {t('loading')}
              </p>
            ) : history.length === 0 ? (
              <p className='text-muted-foreground py-4 text-sm'>
                {t('noTimeYet')}
              </p>
            ) : (
              <>
                {history.map((item) => {
                  const start = item.startedAt ?? item.createdAt
                  const cancelled = Number(item.status) === STAY_CANCELLED
                  const billed = stayBilledHours(item)
                  return (
                    <div
                      key={String(item.id)}
                      className='flex items-center gap-3 border-b py-2.5 text-sm last:border-b-0'
                    >
                      <div className='w-20 shrink-0'>
                        <div className='font-medium'>
                          {start
                            ? new Date(start).toLocaleDateString(locale, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {start &&
                            new Date(start).toLocaleTimeString(locale, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                        </div>
                      </div>
                      <span
                        className={`min-w-0 flex-1 truncate ${item.customerName ? '' : 'text-muted-foreground'}`}
                      >
                        {item.customerName || t('walkIn')}
                      </span>
                      {cancelled ? (
                        <span className='text-destructive text-xs'>
                          {t('cancelled')}
                        </span>
                      ) : (
                        <div className='text-end'>
                          <div className='font-mono font-medium tabular-nums'>
                            {item.startedAt && item.endedAt
                              ? formatDuration(item.startedAt, item.endedAt)
                              : '—'}
                          </div>
                          {billed > 0 && (
                            <div className='text-muted-foreground text-xs tabular-nums'>
                              {formatBillingHours(billed, t)} ·{' '}
                              {formatEgp(item.totalCost)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {history.length >= historyLimit && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='mt-2 w-full'
                    disabled={historyQuery.isFetching}
                    onClick={() =>
                      setHistoryLimit((limit) => limit + HISTORY_PAGE)
                    }
                  >
                    {t('loadMore')}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </ScrollArea>

      <CustomerSearchDialog
        open={pickerFor != null}
        onOpenChange={(open) => {
          if (!open) setPickerFor(null)
        }}
        onSelectCustomer={(picked) => {
          const name = displayName(picked)
          if (pickerFor === 'assign') {
            actions.assignCustomer(stayId, picked.id, name)
          } else {
            actions.addMember(stayId, picked.id, name)
          }
          setPickerFor(null)
        }}
      />

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endTimeQuestion')}
        desc={
          estimate
            ? t('endTimeEstimate', { amount: formatEgp(estimate.amount) })
            : undefined
        }
        cancelBtnText={t('keepGoing')}
        confirmText={t('end')}
        destructive
        isLoading={actions.isBusy}
        handleConfirm={() =>
          actions.endStay(stayId, { onSuccess: () => setConfirmEnd(false) })
        }
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t(held ? 'cancelHoldQuestion' : 'cancelTimeQuestion')}
        cancelBtnText={t('keepIt')}
        confirmText={t(held ? 'cancelHold' : 'cancelTime')}
        destructive
        isLoading={actions.isBusy}
        handleConfirm={() =>
          actions.cancelStay(stayId, held, {
            onSuccess: () => setConfirmCancel(false),
          })
        }
      />

      <ConfirmDialog
        open={pendingOption != null}
        onOpenChange={(open) => {
          if (!open) setPendingOption(null)
        }}
        title={t('switchToRateQuestion', {
          option: localized(findOption(stay?.tariff, pendingOption)?.name),
        })}
        cancelBtnText={t('keepRate', {
          option: localized(findOption(stay?.tariff, currentOption)?.name),
        })}
        confirmText={t('switchRate')}
        isLoading={actions.isBusy}
        handleConfirm={() => {
          if (pendingOption) {
            actions.changeOption(stayId, pendingOption, {
              onSuccess: () => setPendingOption(null),
            })
          }
        }}
      />

      <ConfirmDialog
        open={cancelOrder != null}
        onOpenChange={(open) => {
          if (!open) setCancelOrder(null)
        }}
        title={t('cancelOrderQuestion')}
        cancelBtnText={t('keepOrder')}
        confirmText={t('cancelOrderButton')}
        destructive
        handleConfirm={() => {
          if (cancelOrder != null) orderActions.cancel(cancelOrder)
          setCancelOrder(null)
        }}
      />
    </div>
  )
}
