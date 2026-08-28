import { createFileRoute } from '@tanstack/react-router'
import { Gamepad2 } from 'lucide-react'
import { type ReservationViewModel } from '@/api/rooms'
import { businessDayStart } from '@/lib/business-day'
import { useSelectedBranch } from '@/lib/branch'
import {
  SESSION_ACTIVE,
  SESSION_RESERVED,
  useMySessions,
} from '@/lib/session'
import { RequireAuth } from '@/components/require-auth'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useLanguage,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'

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

function formatDuration(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start) return ''
  const endTime = end ? new Date(end).getTime() : Date.now()
  const minutes = Math.max(
    0,
    Math.round((endTime - new Date(start).getTime()) / 60000)
  )
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function SessionsPage() {
  const t = useT()
  const branch = useSelectedBranch()
  const { data: sessions = [], isLoading } = useMySessions()

  const dayStart = businessDayStart(branch).getTime()
  const todaySessions = sessions.filter(
    (s) => s.createdAt && new Date(s.createdAt).getTime() >= dayStart
  )
  const previousSessions = sessions.filter(
    (s) => !s.createdAt || new Date(s.createdAt).getTime() < dayStart
  )

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>
        {t('sessions')}
      </h1>

      <Tabs defaultValue='today'>
        <TabsList className='w-full'>
          <TabsTrigger value='today' className='flex-1'>
            {t('todaysSessions')}
          </TabsTrigger>
          <TabsTrigger value='previous' className='flex-1'>
            {t('previousSessions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='today' className='mt-4'>
          <SessionList
            sessions={todaySessions}
            isLoading={isLoading}
            emptyTitle={t('noSessionsToday')}
          />
        </TabsContent>
        <TabsContent value='previous' className='mt-4'>
          <SessionList
            sessions={previousSessions}
            isLoading={isLoading}
            emptyTitle={t('noSessionsYet')}
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
}: {
  sessions: ReservationViewModel[]
  isLoading: boolean
  emptyTitle: string
}) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)

  if (isLoading) {
    return (
      <div className='flex flex-col gap-3'>
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
        <p className='text-sm'>{t('reserveRoomToStart')}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      {sessions.map((session) => {
        const status = statusMeta[Number(session.status ?? 0)]
        const duration = formatDuration(
          session.actualStartTime,
          session.endTime
        )
        return (
          <Card key={String(session.id)} className='gap-2 p-4'>
            <div className='flex items-center justify-between gap-2'>
              <span className='font-semibold'>
                {localized(session.roomName)}
              </span>
              {status && (
                <Badge className={status.className}>{t(status.key)}</Badge>
              )}
            </div>
            <div className='text-muted-foreground flex items-center justify-between text-xs'>
              <span>
                {session.createdAt &&
                  new Date(session.createdAt).toLocaleString(
                    language === 'ar' ? 'ar-EG' : 'en-US',
                    { dateStyle: 'medium', timeStyle: 'short' }
                  )}
              </span>
              {/* Mobile parity: time + duration only, no cost */}
              {duration && <span>{t('durationLabel', { duration })}</span>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
