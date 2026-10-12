import { useRef, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import type { BranchResponse } from '@/api/tenant'
import type { PlaceViewModel } from '@/api/spaces'
import { PLACE_AVAILABLE } from '@/lib/places'
import { useDistance } from '@/lib/geo'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type DialBranch = { branch: BranchResponse; places: PlaceViewModel[]; meters: number | null }

/** More rooms than this and the meter shows a share instead of a segment each */
const MAX_SEGMENTS = 10

/**
 * Where there is room, across the business's branches, at a glance: one chip
 * a branch, nearest first, each with a meter lit for every free place. The
 * chosen branch's places are listed under the dial. A row that swipes on a
 * phone; arrow keys move along it as along tabs.
 */
export function BranchDial({
  branches,
  selectedId,
  onSelect,
  panelId,
}: {
  branches: DialBranch[]
  selectedId: number | null
  onSelect: (branchId: number) => void
  panelId: string
}) {
  const t = useT()
  const row = useRef<HTMLDivElement>(null)

  // Arrow keys step along the dial (the row's own direction, so right-to-left in Arabic)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const tabs = [...(row.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const rtl = getComputedStyle(row.current!).direction === 'rtl'
    const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1
    const next = tabs[(at + step + tabs.length) % tabs.length]
    next.focus()
    next.click()
    event.preventDefault()
  }

  return (
    <div
      ref={row}
      role='tablist'
      aria-label={t('bookBranches')}
      onKeyDown={onKeyDown}
      className='no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1'
    >
      {branches.map((b) => (
        <DialChip
          key={String(b.branch.id)}
          dial={b}
          selected={Number(b.branch.id) === selectedId}
          onSelect={onSelect}
          panelId={panelId}
        />
      ))}
    </div>
  )
}

function DialChip({
  dial,
  selected,
  onSelect,
  panelId,
}: {
  dial: DialBranch
  selected: boolean
  onSelect: (branchId: number) => void
  panelId: string
}) {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const id = Number(dial.branch.id)
  const total = dial.places.length
  const free = dial.places.filter((p) => Number(p.status) === PLACE_AVAILABLE).length

  return (
    <button
      type='button'
      role='tab'
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(id)}
      className={cn(
        'relative flex w-40 shrink-0 snap-start flex-col gap-2 rounded-[1.25rem] border p-3 text-start transition-colors',
        selected ? 'text-primary-foreground border-transparent' : 'bg-background border-border',
      )}
    >
      {/* The chosen chip's fill slides from one branch to the next: the dial's one moment of motion */}
      {selected && (
        <motion.span
          layoutId='branch-dial-fill'
          className='bg-primary absolute inset-0 rounded-[1.25rem]'
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          aria-hidden
        />
      )}
      <span className='relative truncate text-body font-semibold'>{localized(dial.branch.name)}</span>
      <SeatMeter free={free} total={total} selected={selected} />
      <span className={cn('relative flex items-baseline justify-between gap-2 text-caption', selected ? 'opacity-90' : 'text-muted-foreground')}>
        <span>{t('bookFreeShort', { count: free })}</span>
        {dial.meters != null && (
          <span className='tabular-nums' dir='ltr'>
            {distance(dial.meters)}
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * The branch's places as a row of segments, each lit while free; a business
 * with more places than fit gets a bar filled by the share that is free.
 * Read out as its words by the chip's text, so it is hidden from screen readers.
 */
export function SeatMeter({ free, total, selected }: { free: number; total: number; selected: boolean }) {
  const lit = selected ? 'bg-primary-foreground' : 'bg-emerald-500'
  const dim = selected ? 'bg-primary-foreground/25' : 'bg-muted'
  if (total === 0) return <span className={cn('relative h-1.5 rounded-full', dim)} aria-hidden />
  if (total > MAX_SEGMENTS) {
    return (
      <span className={cn('relative h-1.5 overflow-hidden rounded-full', dim)} aria-hidden>
        <span className={cn('absolute inset-y-0 start-0 rounded-full', lit)} style={{ width: `${(free / total) * 100}%` }} />
      </span>
    )
  }
  return (
    <span className='relative flex gap-1' aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < free ? lit : dim)} />
      ))}
    </span>
  )
}
