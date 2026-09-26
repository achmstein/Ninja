import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Gamepad2, Timer } from 'lucide-react'
import { type StayViewModel } from '@/api/spaces'
import { dayStartHour, isOvernightShift, useSelectedBranch } from '@/lib/branch'
import { businessDayStart } from '@/lib/business-day'
import { useMyStays } from '@/lib/stays'
import { useLanguage, useT } from '@/lib/i18n'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, SectionLabel, Segment } from '@/components/ninja/page/parts'
import { StayCard } from '@/components/places/stay-card'
import { RequireAuth } from '@/components/require-auth'
import { RequireFeature } from '@/components/require-feature'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/stays')({
  component: () => (
    <RequireFeature feature='timeBilling'>
      <RequireAuth>
        <StaysPage />
      </RequireAuth>
    </RequireFeature>
  ),
})

/** When the stay's clock started */
function startOf(stay: StayViewModel): Date | null {
  const raw = stay.startedAt ?? stay.createdAt
  return raw ? new Date(raw) : null
}

/** The customer's time at the café's rooms and stations: today's, and the
 *  ones before it by shift day, each a card (a running one the slab). */
function StaysPage() {
  const t = useT()
  const branch = useSelectedBranch()
  const { data: stays = [], isLoading } = useMyStays()
  const [tab, setTab] = useState<'today' | 'previous'>('today')

  const dayStart = businessDayStart(branch).getTime()
  const todaySessions = stays.filter((s) => {
    const start = startOf(s)
    return start != null && start.getTime() >= dayStart
  })
  const previousSessions = stays.filter((s) => {
    const start = startOf(s)
    return start == null || start.getTime() < dayStart
  })

  return (
    <NinjaPage title={t('sessions')} back='/profile' push={{ id: 'stays', icon: Timer }}>
      <Segment
        value={tab}
        onChange={setTab}
        options={[
          { value: 'today', label: t('today') },
          { value: 'previous', label: t('earlier') },
        ]}
      />
      {tab === 'today' ? (
        <StayList key='today' stays={todaySessions} isLoading={isLoading} emptyTitle={t('noSessionsToday')} />
      ) : (
        <StayList key='previous' stays={previousSessions} isLoading={isLoading} emptyTitle={t('noSessionsYet')} grouped />
      )}
    </NinjaPage>
  )
}

function StayList({
  stays,
  isLoading,
  emptyTitle,
  grouped = false,
}: {
  stays: StayViewModel[]
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
      <div className='flex flex-col gap-4'>
        {[...Array(3)].map((_, i) => (
          <div key={i} className='surface flex flex-col gap-3 rounded-[1.5rem] p-5'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-8 w-24' />
            <Skeleton className='h-3 w-20' />
          </div>
        ))}
      </div>
    )
  }

  if (stays.length === 0) return <Empty icon={Gamepad2} title={emptyTitle} />

  if (!grouped) {
    return (
      <Rise className='flex flex-col gap-4'>
        {stays.map((stay) => (
          <RiseItem key={String(stay.id)}>
            <StayCard stay={stay} />
          </RiseItem>
        ))}
      </Rise>
    )
  }

  // Overnight shifts: a stay before the start hour belongs to the
  // previous day's shift (same rule as the bills page and the app)
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

  const groups: Array<{ label: string; stays: StayViewModel[] }> = []
  for (const stay of stays) {
    const start = startOf(stay)
    const label = start ? labelFor(shiftDay(start)) : ''
    const group = groups.at(-1)
    if (group && group.label === label) group.stays.push(stay)
    else groups.push({ label, stays: [stay] })
  }

  return (
    <Rise className='flex flex-col gap-4'>
      {groups.map((group) => (
        <div key={group.label} className='flex flex-col gap-3'>
          {group.label && (
            <RiseItem>
              <SectionLabel className='pt-1'>{group.label}</SectionLabel>
            </RiseItem>
          )}
          {group.stays.map((stay) => (
            <RiseItem key={String(stay.id)}>
              <StayCard stay={stay} />
            </RiseItem>
          ))}
        </div>
      ))}
    </Rise>
  )
}
