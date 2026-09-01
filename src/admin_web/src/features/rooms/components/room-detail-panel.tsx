import { useEffect, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Play,
  QrCode,
  Square,
  Star,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  type ReservationViewModel,
  type RoomViewModel,
} from '@/api/spaces'
import {
  addMemberToSessionMutation,
  assignCustomerToSessionMutation,
  cancelSessionMutation,
  changePlayerModeMutation,
  deleteRoomMutation,
  endSessionMutation,
  getRoomSessionHistoryOptions,
  removeMemberFromSessionMutation,
  updateRoomStatusMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { CustomerSearchDialog } from '@/features/accounts/components/customer-search-dialog'
import type { KeycloakUser } from '@/features/accounts/types'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { roomQrUrl } from '@/lib/qr'
import {
  formatBillingHours,
  formatDuration,
  ROOM_MAINTENANCE,
  ROOM_PHYSICAL_AVAILABLE,
  ROOM_PHYSICAL_MAINTENANCE,
  roomStatusConfig,
  SESSION_ACTIVE,
  SESSION_CANCELLED,
  SESSION_RESERVED,
  sessionBilledHours,
} from '../status'
import { PlayerModeToggle, type PlayerMode } from './player-mode-toggle'
import { RoomDialog } from './room-dialog'

const HISTORY_PAGE = 20

function displayName(user: KeycloakUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || user.username
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Seconds spent in one player mode across the session's segments. */
function modeSeconds(
  session: ReservationViewModel,
  mode: PlayerMode,
  nowMs: number
): number {
  return (session.segments ?? [])
    .filter((segment) => segment.playerMode === mode && segment.startTime)
    .reduce((sum, segment) => {
      const end = segment.endTime ? new Date(segment.endTime).getTime() : nowMs
      return sum + (end - new Date(segment.startTime!).getTime()) / 1000
    }, 0)
}

interface RoomDetailPanelProps {
  room: RoomViewModel
  session: ReservationViewModel | undefined
  onBack: () => void
  onWalkIn: () => void
  onReserve: () => void
  onStartReserved: (session: ReservationViewModel) => void
}

/** Right-hand pane of the rooms master-detail: the room's current state with
 *  session controls on top and its session history below — mirroring the
 *  admin mobile app's room detail screen. Hours only, no money. */
export function RoomDetailPanel({
  room,
  session,
  onBack,
  onWalkIn,
  onReserve,
  onStartReserved,
}: RoomDetailPanelProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const roomId = Number(room.id)

  // 1s clock for the live timer and the reservation countdown
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // The parent keys this panel by room id, so switching rooms resets this
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE)

  const historyQuery = useQuery({
    ...getRoomSessionHistoryOptions({
      path: { roomId },
      query: { limit: historyLimit },
    }),
    placeholderData: keepPreviousData,
  })
  const history = historyQuery.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getActiveSessions' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getSessionHistory' }] })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getRoomSessionHistory' }],
    })
  }

  const endSession = useMutation({
    ...endSessionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('sessionEnded'))
    },
    onError: () => toast.error(t('failedToEndSession')),
  })

  const setStatus = useMutation({
    ...updateRoomStatusMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('roomSavedSuccess'))
    },
    onError: () => toast.error(t('failedToSaveRoom')),
  })

  const deleteRoom = useMutation({
    ...deleteRoomMutation(),
    onSuccess: () => {
      invalidate()
      setConfirmDelete(false)
      toast.success(t('roomDeletedSuccess'))
      // The selected room is gone, so drop back to the empty state
      onBack()
    },
    // The server refuses while a session is active or reserved; surface its
    // reason rather than a generic failure
    onError: (error) => {
      const problem = error.response?.data as { detail?: string } | undefined
      toast.error(problem?.detail ?? t('failedToDeleteRoom'))
    },
  })

  const cancelSession = useMutation({
    ...cancelSessionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('reservationCancelled'))
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })

  const changeMode = useMutation({
    ...changePlayerModeMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('playerModeUpdated'))
    },
    onError: () => toast.error(t('failedToChangePlayerMode')),
  })

  const removeMember = useMutation({
    ...removeMemberFromSessionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('memberRemoved'))
    },
    onError: () => toast.error(t('failedToRemoveMember')),
  })

  const addMember = useMutation({
    ...addMemberToSessionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('customerAdded'))
    },
    onError: () => toast.error(t('failedToAddCustomer')),
  })

  const assignCustomer = useMutation({
    ...assignCustomerToSessionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('customerAssigned'))
    },
    onError: () => toast.error(t('failedToAssignCustomer')),
  })

  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingMode, setPendingMode] = useState<PlayerMode | null>(null)
  // Customer picker: adds a member (active) or assigns the owner (reserved)
  const [pickerFor, setPickerFor] = useState<'member' | 'assign' | null>(null)

  const isActive = session != null && Number(session.status) === SESSION_ACTIVE
  const isReserved =
    session != null && Number(session.status) === SESSION_RESERVED
  const isMaintenance = Number(room.displayStatus) === ROOM_MAINTENANCE
  const roomStatus = roomStatusConfig[Number(room.displayStatus ?? 0)]

  const sessionId = Number(session?.id)
  const currentMode = (session?.currentPlayerMode ?? null) as PlayerMode | null
  const elapsedSeconds =
    isActive && session.actualStartTime
      ? (now - new Date(session.actualStartTime).getTime()) / 1000
      : 0
  const singleSeconds = isActive ? modeSeconds(session, 'Single', now) : 0
  const multiSeconds = isActive ? modeSeconds(session, 'Multi', now) : 0

  const singleHours = Number(session?.singleRoundedHours ?? 0)
  const multiHours = Number(session?.multiRoundedHours ?? 0)
  const billedLabel = formatBillingHours(
    session ? sessionBilledHours(session) : 0,
    t
  )

  const expiresInSeconds =
    isReserved && session.expiresAt
      ? Math.max(0, (new Date(session.expiresAt).getTime() - now) / 1000)
      : null

  const copyQrLink = () => {
    navigator.clipboard.writeText(roomQrUrl(roomId))
    toast.success(t('roomLinkCopied'))
  }

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
            aria-label={t('backToRooms')}
          >
            <ArrowLeft className='rtl:rotate-180' />
          </Button>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${roomStatus?.dotClass ?? 'bg-muted'}`}
          />
          <h2 className='truncate font-semibold'>{localized(room.name)}</h2>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm tabular-nums'>
            {t('dualRateFormat', {
              singleRate: String(Number(room.singleRate ?? 0)),
              multiRate: String(Number(room.multiRate ?? 0)),
            })}
          </span>
          <Button
            size='icon'
            variant='ghost'
            onClick={copyQrLink}
            aria-label={t('copyRoomLink')}
          >
            <QrCode className='h-4 w-4' />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='icon' variant='ghost' aria-label={t('actions')}>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isActive || isReserved || setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({
                    path: { id: Number(roomId) },
                    query: {
                      status: isMaintenance
                        ? ROOM_PHYSICAL_AVAILABLE
                        : ROOM_PHYSICAL_MAINTENANCE,
                    },
                  })
                }
              >
                {t(isMaintenance ? 'statusAvailable' : 'statusMaintenance')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                disabled={isActive || isReserved}
                onClick={() => setConfirmDelete(true)}
              >
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Now (fixed) */}
      <div className='flex-none'>
        {isActive ? (
          <div className='flex flex-col items-center gap-4 px-4 py-6'>
            <span className='font-mono text-5xl font-light tracking-widest tabular-nums'>
              {formatClock(elapsedSeconds)}
            </span>
            {(singleSeconds > 0 || multiSeconds > 0) && (
              <div className='text-muted-foreground flex gap-4 font-mono text-xs'>
                {singleSeconds > 0 && (
                  <span>
                    {t('playerModeSingle')} {formatClock(singleSeconds)}
                  </span>
                )}
                {multiSeconds > 0 && (
                  <span>
                    {t('playerModeMulti')} {formatClock(multiSeconds)}
                  </span>
                )}
              </div>
            )}

            <PlayerModeToggle
              className='w-full max-w-xs'
              value={currentMode}
              onChange={(mode) => {
                if (mode && mode !== currentMode) setPendingMode(mode)
              }}
              disabled={changeMode.isPending}
            />

            {(session.members?.length ?? 0) > 0 ? (
              <div className='flex flex-wrap items-center justify-center gap-2'>
                {session.members!.map((member) => {
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
                          disabled={removeMember.isPending}
                          onClick={() =>
                            removeMember.mutate({
                              path: {
                                sessionId,
                                customerId: member.customerId!,
                              },
                            })
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
                  disabled={addMember.isPending}
                  onClick={() => setPickerFor('member')}
                  className='text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50'
                >
                  <UserPlus className='h-3 w-3' />
                  {t('add')}
                </button>
              </div>
            ) : (
              <>
                {session.customerName && (
                  <p className='text-muted-foreground flex items-center gap-1 text-sm'>
                    <User className='h-3.5 w-3.5' />
                    {session.customerName}
                  </p>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  disabled={addMember.isPending}
                  onClick={() => setPickerFor('member')}
                >
                  <UserPlus className='me-1 h-4 w-4' />
                  {t('addCustomer')}
                </Button>
              </>
            )}

            {/* Billed hours in POS quarter-hour steps — no money; hidden
                until the first quarter-hour lands (mobile-admin parity) */}
            {(singleHours > 0 || multiHours > 0) && (
              <div className='w-full max-w-xs space-y-1 rounded-lg border p-3 text-sm'>
                {singleHours > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      {t('playerModeSingle')}
                    </span>
                    <span className='tabular-nums'>
                      {formatBillingHours(singleHours, t)}
                    </span>
                  </div>
                )}
                {multiHours > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      {t('playerModeMulti')}
                    </span>
                    <span className='tabular-nums'>
                      {formatBillingHours(multiHours, t)}
                    </span>
                  </div>
                )}
                <Separator className='my-2' />
                <div className='flex justify-between font-semibold'>
                  <span>{t('billedHours')}</span>
                  <span className='tabular-nums'>{billedLabel}</span>
                </div>
              </div>
            )}

            <Button
              variant='destructive'
              disabled={endSession.isPending}
              onClick={() => setConfirmEnd(true)}
            >
              <Square className='me-1 h-4 w-4' />
              {t('endSessionButton')}
            </Button>
          </div>
        ) : isReserved ? (
          <div className='flex flex-col items-center gap-3 px-4 py-8'>
            <div className='flex size-16 items-center justify-center rounded-full bg-amber-500/10'>
              <Clock className='size-7 text-amber-500' />
            </div>
            <p className='font-medium'>{t('readyToStart')}</p>
            {session.customerName ? (
              <p className='text-muted-foreground flex items-center gap-1 text-sm'>
                <User className='h-3.5 w-3.5' />
                {session.customerName}
              </p>
            ) : (
              <Button
                variant='outline'
                size='sm'
                disabled={assignCustomer.isPending}
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
            <div className='mt-2 flex gap-2'>
              <Button
                variant='outline'
                disabled={cancelSession.isPending}
                onClick={() => setConfirmCancel(true)}
              >
                <X className='me-1 h-4 w-4' />
                {t('cancel')}
              </Button>
              <Button onClick={() => onStartReserved(session)}>
                <Play className='me-1 h-4 w-4 rtl:rotate-180' />
                {t('startSession')}
              </Button>
            </div>
          </div>
        ) : isMaintenance ? (
          <div className='flex flex-col items-center gap-3 px-4 py-8'>
            <div className='bg-muted flex size-16 items-center justify-center rounded-full'>
              <Wrench className='text-muted-foreground size-7' />
            </div>
            <p className='text-muted-foreground font-medium'>
              {t('underMaintenance')}
            </p>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-3 px-4 py-8'>
            <div className='flex size-16 items-center justify-center rounded-full bg-green-500/10'>
              <CheckCircle2 className='size-7 text-green-500' />
            </div>
            <p className='font-medium'>{t('available')}</p>
            {room.description && localized(room.description) && (
              <p className='text-muted-foreground max-w-sm text-center text-sm'>
                {localized(room.description)}
              </p>
            )}
            <div className='mt-2 flex gap-2'>
              <Button variant='outline' onClick={onReserve}>
                <CalendarClock className='me-1 h-4 w-4' />
                {t('reserve')}
              </Button>
              <Button onClick={onWalkIn}>
                <Play className='me-1 h-4 w-4 rtl:rotate-180' />
                {t('walkIn')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* History (scrolls independently when it exceeds the height) */}
      <div className='flex min-h-0 flex-1 flex-col border-t'>
        <h3 className='flex-none px-4 pt-3 pb-1 text-sm font-semibold'>
          {t('history')}
        </h3>
        <ScrollArea className='min-h-0 flex-1 px-4 pb-4'>
          {historyQuery.isLoading ? (
            <p className='text-muted-foreground py-4 text-sm'>{t('loading')}</p>
          ) : history.length === 0 ? (
            <p className='text-muted-foreground py-4 text-sm'>
              {t('noSessionsYet')}
            </p>
          ) : (
            <>
              {history.map((item) => {
                const start = item.actualStartTime ?? item.createdAt
                const cancelled =
                  Number(item.status) === SESSION_CANCELLED
                const billed = sessionBilledHours(item)
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
                          {item.actualStartTime && item.endTime
                            ? formatDuration(
                                item.actualStartTime,
                                item.endTime
                              )
                            : '—'}
                        </div>
                        {billed > 0 && (
                          <div className='text-muted-foreground text-xs tabular-nums'>
                            {formatBillingHours(billed, t)}
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
                  onClick={() => setHistoryLimit((limit) => limit + HISTORY_PAGE)}
                >
                  {t('loadMore')}
                </Button>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      <CustomerSearchDialog
        open={pickerFor != null}
        onOpenChange={(open) => {
          if (!open) setPickerFor(null)
        }}
        onSelectCustomer={(picked) => {
          const body = { customerId: picked.id, customerName: displayName(picked) }
          if (pickerFor === 'assign') {
            assignCustomer.mutate({ path: { sessionId }, body })
          } else {
            addMember.mutate({ path: { sessionId }, body })
          }
          setPickerFor(null)
        }}
      />

      {/* End-session confirmation */}
      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('endThisSession')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('endSessionBilledAt', { hours: billedLabel })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepPlaying')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() =>
                endSession.mutate({ path: { sessionId } })
              }
            >
              {t('endSessionButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel-reservation confirmation */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelThisReservation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roomBecomesAvailable')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepIt')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() =>
                cancelSession.mutate({ path: { sessionId } })
              }
            >
              {t('cancelReservation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mode-change confirmation */}
      <AlertDialog
        open={pendingMode != null}
        onOpenChange={(open) => !open && setPendingMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('switchToModeQuestion', {
                mode: t(
                  pendingMode === 'Multi'
                    ? 'playerModeMulti'
                    : 'playerModeSingle'
                ),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('switchModeDescription', {
                current: t(
                  currentMode === 'Multi'
                    ? 'playerModeMulti'
                    : 'playerModeSingle'
                ),
                next: t(
                  pendingMode === 'Multi'
                    ? 'playerModeMulti'
                    : 'playerModeSingle'
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('keepCurrent', {
                mode: t(
                  currentMode === 'Multi'
                    ? 'playerModeMulti'
                    : 'playerModeSingle'
                ),
              })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMode) {
                  changeMode.mutate({
                    path: { sessionId },
                    body: { playerMode: pendingMode },
                  })
                }
                setPendingMode(null)
              }}
            >
              {t('switchMode')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRoom')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteRoomConfirmation', { name: localized(room.name) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRoom.isPending}
              onClick={() => deleteRoom.mutate({ path: { id: roomId } })}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editOpen && <RoomDialog room={room} open onOpenChange={setEditOpen} />}
    </div>
  )
}
