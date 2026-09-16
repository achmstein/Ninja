import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Clock, Gamepad2, Timer, Users } from 'lucide-react'
import {
  type ReservationViewModel,
  type SessionSegmentViewModel,
} from '@/api/spaces'
import {
  dayStartHour,
  isOvernightShift,
  useSelectedBranch,
} from '@/lib/branch'
import { businessDayStart } from '@/lib/business-day'
import {
  SESSION_ACTIVE,
  SESSION_RESERVED,
  useMySessions,
} from '@/lib/session'
import { BackHeader } from '@/components/back-header'
import { RequireAuth } from '@/components/require-auth'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/sessions')({
  component: () => (
    <RequireAuth>
      <SessionsPage />
    </RequireAuth>
  ),
})

const statusMeta: Record<
  number,
  { key: TranslationKey; className: string }
> = {
  [SESSION_RESERVED]: {
    key: 'statusReserved',
    className:
      'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  [SESSION_ACTIVE]: {
    key: 'statusActive',
    className:
      'border-transparent bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
  3: { key: 'statusCompleted', className: 'border-transparent bg-muted text-muted-foreground' },
  4: {
    key: 'statusCancelled',
    className:
      'border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
}

/** When the session's clock started: the real start, or the booking for one never started */
function startOf(session: ReservationViewModel): Date | null {
  const raw = session.actualStartTime ?? session.createdAt
  return raw ? new Date(raw) : null
}

/** Ticks once a second while `on`, so a running session's duration moves (mobile parity) */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [on])
  return now
}

function SessionsPage() {
  const t = useT()
  const branch = useSelectedBranch()
  const { data: sessions = [], isLoading } = useMySessions()

  const dayStart = businessDayStart(branch).getTime()
  const todaySessions = sessions.filter((s) => {
    const start = startOf(s)
    return start != null && start.getTime() >= dayStart
  })
  const previousSessions = sessions.filter((s) => {
    const start = startOf(s)
    return start == null || start.getTime() < dayStart
  })

  return (
    <div className='flex flex-col gap-4 p-4'>
      <BackHeader title={t('sessions')} />

      <Tabs defaultValue='today'>
        <TabsList className='w-full'>
          <TabsTrigger value='today' className='flex-1'>
            {t('todaysSessions')}
          </TabsTrigger>
          <TabsTrigger value='previous' className='flex-1'>
            {t('previousSessions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='today' className='mt-2'>
          <SessionList
            sessions={todaySessions}
            isLoading={isLoading}
            emptyTitle={t('noSessionsToday')}
          />
        </TabsContent>
        <TabsContent value='previous' className='mt-2'>
          <SessionList
            sessions={previousSessions}
            isLoading={isLoading}
            emptyTitle={t('noSessionsYet')}
            grouped
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SessionList({
  sessions,
  isLoading,
  emptyTitle,
  grouped = false,
}: {
  sessions: ReservationViewModel[]
  isLoading: boolean
  emptyTitle: string
  /** History: one heading per shift day (Today, Yesterday, a date), like the app */
  grouped?: boolean
}) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branch = useSelectedBranch()

  if (isLoading) {
    return (
      <div className='flex flex-col gap-3 pt-2'>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className='h-20 rounded-xl' />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className='text-muted-foreground flex h-[40svh] flex-col items-center justify-center gap-2 text-center'>
        <Gamepad2 className='text-muted-foreground/40 h-10 w-10' />
        <p>{emptyTitle}</p>
      </div>
    )
  }

  if (!grouped) {
    return (
      <div className='divide-y'>
        {sessions.map((session) => (
          <SessionTile key={String(session.id)} session={session} />
        ))}
      </div>
    )
  }

  // Overnight shifts: a session before the start hour belongs to the
  // previous day's shift (same rule as the orders page and the app)
  const startHour = dayStartHour(branch)
  const overnight = isOvernightShift(branch)
  const shiftDay = (date: Date): Date => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (overnight && date.getHours() < startHour) day.setDate(day.getDate() - 1)
    return day
  }
  const todayShift = shiftDay(new Date())
  const yesterdayShift = new Date(todayShift)
  yesterdayShift.setDate(yesterdayShift.getDate() - 1)
  const labelFor = (day: Date): string => {
    if (day.getTime() === todayShift.getTime()) return t('today')
    if (day.getTime() === yesterdayShift.getTime()) return t('yesterday')
    return day.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  const groups: Array<{ label: string; sessions: ReservationViewModel[] }> = []
  for (const session of sessions) {
    const start = startOf(session)
    const label = start ? labelFor(shiftDay(start)) : ''
    const group = groups.at(-1)
    if (group && group.label === label) group.sessions.push(session)
    else groups.push({ label, sessions: [session] })
  }

  return (
    <div className='flex flex-col'>
      {groups.map((group) => (
        <div key={group.label} className='flex flex-col'>
          <h3 className='text-muted-foreground pt-4 pb-1 text-[13px] font-semibold'>
            {group.label}
          </h3>
          <div className='divide-y'>
            {group.sessions.map((session) => (
              <SessionTile key={String(session.id)} session={session} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Session tile (mobile parity): room + status, time + live duration,
//    the mode timeline, the other people in the room ──

function SessionTile({ session }: { session: ReservationViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const auth = useAuth()
  const active = Number(session.status ?? 0) === SESSION_ACTIVE
  const now = useNow(active)

  const timeOf = (raw: string | null | undefined) =>
    raw
      ? new Date(raw).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : ''
  const durationOf = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return ''
    const endMs = end ? new Date(end).getTime() : now
    const minutes = Math.max(0, Math.floor((endMs - new Date(start).getTime()) / 60000))
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0
      ? `${t('hoursShort', { count: h })} ${t('minutesShort', { count: m })}`
      : t('minutesShort', { count: m })
  }
  const modeLabel = (mode: string | undefined) =>
    mode === 'Single' ? t('playerModeSingle') : mode === 'Multi' ? t('playerModeMulti') : (mode ?? '')
  const modeClass = (mode: string | undefined) =>
    mode === 'Single' ? 'text-primary' : 'text-orange-500'
  const dotClass = (mode: string | undefined) =>
    mode === 'Single' ? 'bg-primary' : 'bg-orange-500'

  const start = startOf(session)
  const started = session.actualStartTime != null
  const duration = started ? durationOf(session.actualStartTime, session.endTime) : ''
  const segments: SessionSegmentViewModel[] = session.segments ?? []
  const myId = auth.user?.profile?.sub
  const others = (session.members ?? []).filter((m) => m.customerId !== myId)
  const status = statusMeta[Number(session.status ?? 0)]

  return (
    <div className='flex flex-col gap-2 py-3'>
      <div className='flex items-center gap-2'>
        <Gamepad2 className='h-5 w-5 shrink-0' />
        <span className='min-w-0 flex-1 truncate font-bold'>
          {localized(session.roomName)}
        </span>
        {session.paidAt != null ? (
          // Sales' receipt, projected onto the session by Spaces
          <Badge variant='secondary' className='tabular-nums'>
            {session.paidWith === 'Account' ? t('onYourTab') : t('paid')}
            {session.receiptNumber != null &&
              ` ${t('receiptShort', { number: Number(session.receiptNumber) })}`}
          </Badge>
        ) : (
          status && <Badge className={status.className}>{t(status.key)}</Badge>
        )}
      </div>

      <div className='text-muted-foreground flex items-center gap-3 text-[13px] tabular-nums'>
        <span className='flex items-center gap-1'>
          <Clock className='h-3.5 w-3.5' />
          {start && timeOf(start.toISOString())}
        </span>
        {duration && (
          <span className='flex items-center gap-1'>
            <Timer className='h-3.5 w-3.5' />
            {duration}
          </span>
        )}
        {session.totalCost != null && (
          <span className='ms-auto font-medium'>{price(Number(session.totalCost))}</span>
        )}
      </div>

      {segments.length > 1 ? (
        <ol className='flex flex-col'>
          {segments.map((segment, i) => {
            const last = i === segments.length - 1
            return (
              <li key={i} className='flex items-stretch gap-2'>
                <span className='flex w-3 flex-col items-center'>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotClass(segment.playerMode))} />
                  {!last && <span className='bg-border w-px flex-1' />}
                </span>
                <span className={cn('flex items-baseline gap-2 text-[13px]', !last && 'pb-1.5')}>
                  <span className={cn('font-medium', modeClass(segment.playerMode))}>
                    {modeLabel(segment.playerMode)}
                  </span>
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {timeOf(segment.startTime)} · {durationOf(segment.startTime, segment.endTime)}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        segments.length === 1 && (
          <span
            className={cn(
              'w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold',
              segments[0].playerMode === 'Single'
                ? 'bg-primary/10 text-primary'
                : 'bg-orange-500/10 text-orange-500'
            )}
          >
            {modeLabel(segments[0].playerMode)}
          </span>
        )
      )}

      {others.length > 0 && (
        <div className='text-muted-foreground flex items-center gap-1 text-[13px]'>
          <Users className='h-3.5 w-3.5 shrink-0' />
          <span className='truncate'>{others.map((m) => m.customerName ?? '?').join(', ')}</span>
        </div>
      )}
    </div>
  )
}
