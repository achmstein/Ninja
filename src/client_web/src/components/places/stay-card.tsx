import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { motion } from 'motion/react'
import { Clock, Users } from 'lucide-react'
import { type StaySegmentViewModel, type StayViewModel } from '@/api/spaces'
import { springSoft } from '@/lib/motion'
import { hasOptions, optionColor, PlaceIcon, STAY_CANCELLED, STAY_ENDED, STAY_RUNNING } from '@/lib/places'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'
import { Panel, Slab } from '@/components/ninja/page/parts'

/** Ticks once a second while `on`, so a running stay's duration moves (mobile parity) */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [on])
  return now
}

/**
 * One stay in the history (app parity: place and status, when and how
 * long, the rates it ran at, the other people there). A running one is the
 * dark slab with its time rolling; the rest are light cards. Where the rate
 * changed along the way, a bar split by how long each rate ran shows it at
 * a glance, drawn in from the start when the card arrives.
 */
export function StayCard({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const auth = useAuth()
  const active = Number(stay.status ?? 0) === STAY_RUNNING
  const now = useNow(active)

  const timeOf = (raw: string | null | undefined) =>
    raw ? new Date(raw).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const minutesOf = (start: string | null | undefined, end: string | null | undefined) =>
    start ? Math.max(0, Math.floor(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 60000)) : 0
  const durationOf = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return ''
    const minutes = minutesOf(start, end)
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${t('hoursShort', { count: h })} ${t('minutesShort', { count: m })}` : t('minutesShort', { count: m })
  }
  // The base rate wears the café's colour, which the dark slab is made of: on it, the slab's own light instead
  const color = (code: string | undefined) => {
    const c = optionColor(stay.tariff, code)
    return active && c.dot === 'bg-primary' ? { dot: 'bg-background', text: '', chip: 'bg-muted' } : c
  }

  const startRaw = stay.startedAt ?? stay.createdAt
  const start = startRaw ? new Date(startRaw) : null
  const duration = stay.startedAt != null ? durationOf(stay.startedAt, stay.endedAt) : ''
  const segments: StaySegmentViewModel[] = stay.segments ?? []
  // A one-rate place has nothing to tell apart: no option pill, no bar
  const showOptions = hasOptions(stay.tariff)
  const myId = auth.user?.profile?.sub
  const others = (stay.members ?? []).filter((m) => m.customerId !== myId)
  const Surface = active ? Slab : Panel

  return (
    <Surface className={cn('relative isolate flex flex-col gap-3 overflow-hidden', !active && 'p-5')}>
      <PlaceIcon
        kind={Number(stay.placeKind)}
        className={cn('pointer-events-none absolute -end-5 -bottom-6 -z-10 size-32 -rotate-12', active ? 'opacity-[0.08]' : 'opacity-[0.05]')}
      />

      <div className='flex items-center gap-2'>
        <span className='flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold'>
          <PlaceIcon kind={Number(stay.placeKind)} className='size-4 shrink-0' />
          <span className='truncate'>{localized(stay.placeName)}</span>
        </span>
        <StatusChip stay={stay} />
      </div>

      <div className='flex items-end justify-between gap-3'>
        <div className='flex min-w-0 flex-col'>
          {/* A stay cancelled before its clock started has no length to show */}
          {duration && <span className='text-[1.75rem] leading-tight font-extrabold'>{active ? <Odometer value={duration} /> : duration}</span>}
          {start && (
            <span className='text-muted-foreground flex items-center gap-1 text-[13px] tabular-nums'>
              <Clock className='size-3.5' />
              {timeOf(start.toISOString())}
              {stay.endedAt && ` – ${timeOf(stay.endedAt)}`}
            </span>
          )}
        </div>
        {stay.totalCost != null && <span className='shrink-0 text-lg font-bold tabular-nums'>{price(Number(stay.totalCost))}</span>}
      </div>

      {showOptions && segments.length > 1 ? (
        <RateBar segments={segments} minutesOf={minutesOf} durationOf={durationOf} timeOf={timeOf} color={color} />
      ) : (
        showOptions &&
        segments.length === 1 && (
          <span className={cn('w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold', color(segments[0].optionCode).chip)}>
            {localized(segments[0].optionName)}
          </span>
        )
      )}

      {others.length > 0 && (
        <div className='text-muted-foreground flex items-center gap-1.5 text-[13px]'>
          <Users className='size-3.5 shrink-0' />
          <span className='truncate'>{others.map((m) => m.customerName ?? '?').join(', ')}</span>
        </div>
      )}
    </Surface>
  )
}

/** The rates a stay ran at: a bar split by how long each ran, and each one under it with when it started and for how long */
function RateBar({
  segments,
  minutesOf,
  durationOf,
  timeOf,
  color,
}: {
  segments: StaySegmentViewModel[]
  minutesOf: (start: string | null | undefined, end: string | null | undefined) => number
  durationOf: (start: string | null | undefined, end: string | null | undefined) => string
  timeOf: (raw: string | null | undefined) => string
  color: (code: string | undefined) => { dot: string; text: string }
}) {
  const localized = useLocalized()
  return (
    <div className='flex flex-col gap-2'>
      <motion.div
        aria-hidden
        className='flex h-2 origin-left gap-0.5 overflow-hidden rounded-full rtl:origin-right'
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...springSoft, delay: 0.15 }}
      >
        {segments.map((segment, i) => (
          <span
            key={i}
            className={cn('h-full rounded-full', color(segment.optionCode).dot)}
            style={{ flexGrow: Math.max(1, minutesOf(segment.startTime, segment.endTime)) }}
          />
        ))}
      </motion.div>
      <ol className='flex flex-col gap-0.5'>
        {segments.map((segment, i) => (
          <li key={i} className='flex items-baseline gap-2 text-[13px]'>
            <span className={cn('size-2 shrink-0 self-center rounded-full', color(segment.optionCode).dot)} />
            <span className={cn('font-semibold', color(segment.optionCode).text)}>{localized(segment.optionName)}</span>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {timeOf(segment.startTime)} · {durationOf(segment.startTime, segment.endTime)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Paid (a tap opens the receipt), running, done or cancelled */
function StatusChip({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const base = 'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums'
  const status = Number(stay.status ?? 0)
  if (stay.paidAt != null) {
    // Sales' receipt, projected onto the stay by Spaces
    return (
      <Link
        to='/receipts/$ticketId'
        params={{ ticketId: String(stay.ticketId ?? '') }}
        disabled={stay.ticketId == null}
        className={cn(base, 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400')}
      >
        {stay.paidWith === 'Account' ? t('onYourTab') : t('paid')}
        {stay.receiptNumber != null && ` ${t('receiptShort', { number: Number(stay.receiptNumber) })}`}
      </Link>
    )
  }
  if (status === STAY_RUNNING) {
    return (
      <span className={cn(base, 'flex items-center gap-1.5 bg-emerald-500/15 text-emerald-500')}>
        <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
        {t('statusActive')}
      </span>
    )
  }
  if (status === STAY_CANCELLED) return <span className={cn(base, 'bg-destructive/10 text-destructive')}>{t('statusCancelled')}</span>
  if (status === STAY_ENDED) return <span className={cn(base, 'bg-muted text-muted-foreground')}>{t('statusCompleted')}</span>
  return null
}
