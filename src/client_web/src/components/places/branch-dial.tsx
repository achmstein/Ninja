import { useRef, useState, type KeyboardEvent } from 'react'
import { Check, Navigation, Search } from 'lucide-react'
import { motion } from 'motion/react'
import type { PlaceViewModel } from '@ninja/api/spaces'
import type { BranchResponse } from '@ninja/api/tenant'
import { directionsUrl, pointOf, useDistance } from '@/lib/geo'
import { useLocalized, useT } from '@/lib/i18n'
import { PLACE_AVAILABLE } from '@/lib/places'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export type DialBranch = { branch: BranchResponse; places: PlaceViewModel[]; meters: number | null }

/** More rooms than this and the meter shows a share instead of a segment each */
const MAX_SEGMENTS = 10

/** More branches than this and the dial shows the nearest few, then All branches */
const DIAL_MAX = 6

/** How many branches the dial shows before All branches, past DIAL_MAX */
const DIAL_SHOWN = 5

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
  const [allOpen, setAllOpen] = useState(false)
  // Many branches: the nearest few and the chosen one, then the way to every one of them, searched by name
  const many = branches.length > DIAL_MAX
  const shown = many
    ? [
        ...branches.slice(0, DIAL_SHOWN),
        ...branches.slice(DIAL_SHOWN).filter((b) => Number(b.branch.id) === selectedId),
      ]
    : branches

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
      // A phone swipes the row, each chip snapping to the edge; wider, every branch is in view, wrapped
      // into rows, nothing to swipe for (a mouse wheel does not scroll sideways)
      className='no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0'
    >
      {shown.map((b) => (
        <DialChip
          key={String(b.branch.id)}
          dial={b}
          selected={Number(b.branch.id) === selectedId}
          onSelect={onSelect}
          panelId={panelId}
        />
      ))}
      {many && (
        <button
          type='button'
          onClick={() => setAllOpen(true)}
          className='bg-background border-border flex w-40 shrink-0 snap-start flex-col gap-2 rounded-[1.25rem] border p-3 text-start'
        >
          <span className='text-body flex h-8 items-center gap-2 font-semibold'>
            <span className='min-w-0 flex-1 truncate'>{t('bookAllBranches')}</span>
            <span className='bg-muted grid size-8 shrink-0 place-items-center rounded-full'>
              <Search className='size-4' />
            </span>
          </span>
          {/* Where the others' meters stand: kept so the chip stands as tall as its neighbours */}
          <span className='h-1.5' aria-hidden />
          <span className='text-muted-foreground text-caption truncate'>
            {t('bookMoreBranches', { count: branches.length - shown.length })}
          </span>
        </button>
      )}
      {many && (
        <AllBranchesSheet
          open={allOpen}
          onOpenChange={setAllOpen}
          branches={branches}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

/**
 * Every branch taking bookings, as a sheet: searched by name in either
 * language, nearest first, each with how many places are free there and how
 * far it is. A tap shows that branch's places under the dial.
 */
function AllBranchesSheet({
  open,
  onOpenChange,
  branches,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: DialBranch[]
  selectedId: number | null
  onSelect: (branchId: number) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // Either language's name answers, whichever the customer types in
  const found = branches.filter(
    (b) => !q || `${b.branch.name?.en ?? ''} ${b.branch.name?.ar ?? ''}`.toLowerCase().includes(q)
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('')
        onOpenChange(next)
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('bookAllBranches')}</SheetTitle>
        </SheetHeader>
        <Input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('bookSearchBranches')}
          enterKeyHint='search'
          className='h-12 text-base'
        />
        {found.length === 0 ? (
          <p className='text-muted-foreground text-caption py-6 text-center'>{t('bookNoBranchFound')}</p>
        ) : (
          <div className='flex max-h-[50svh] flex-col gap-1 overflow-y-auto'>
            {found.map((b) => {
              const id = Number(b.branch.id)
              const chosen = id === selectedId
              const free = b.places.filter((p) => Number(p.status) === PLACE_AVAILABLE).length
              return (
                <button
                  key={String(b.branch.id)}
                  type='button'
                  onClick={() => {
                    onSelect(id)
                    onOpenChange(false)
                    setQuery('')
                  }}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-[0.875rem] px-3 py-2 text-start',
                    chosen && 'bg-muted'
                  )}
                >
                  {/* Free there now, at a glance */}
                  <span
                    className={cn('size-2 shrink-0 rounded-full', free > 0 ? 'bg-emerald-500' : 'bg-border')}
                    aria-hidden
                  />
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='text-body truncate font-semibold'>{localized(b.branch.name)}</span>
                    <span className='text-muted-foreground text-caption'>{t('bookFreeShort', { count: free })}</span>
                  </span>
                  {b.meters != null && (
                    <span className='text-muted-foreground text-caption tabular-nums' dir='ltr'>
                      {distance(b.meters)}
                    </span>
                  )}
                  {chosen && <Check className='size-4 shrink-0' />}
                </button>
              )
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
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
  // The way there, on the branch it leads to: the chosen one, when it is on the map. Beside the chip's
  // button rather than in it (a link cannot sit inside a button), over its top end corner
  const point = selected ? pointOf(dial.branch) : null

  return (
    <div className='relative shrink-0 snap-start'>
      <button
        type='button'
        role='tab'
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        onClick={() => onSelect(id)}
        className={cn(
          'relative flex w-40 flex-col gap-2 rounded-[1.25rem] border p-3 text-start transition-colors',
          selected ? 'text-primary-foreground border-transparent' : 'bg-background border-border'
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
        {/* One height on every chip, the chosen one's way there or not */}
        <span className={cn('text-body relative flex h-8 items-center truncate font-semibold', point && 'pe-9')}>
          <span className='truncate'>{localized(dial.branch.name)}</span>
        </span>
        <SeatMeter free={free} total={total} selected={selected} />
        <span
          className={cn(
            'text-caption relative flex items-baseline justify-between gap-2',
            selected ? 'opacity-90' : 'text-muted-foreground'
          )}
        >
          <span>{t('bookFreeShort', { count: free })}</span>
          {dial.meters != null && (
            <span className='tabular-nums' dir='ltr'>
              {distance(dial.meters)}
            </span>
          )}
        </span>
      </button>
      {point && (
        <a
          href={directionsUrl(point)}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={t('directions')}
          className='bg-primary-foreground/20 text-primary-foreground active:bg-primary-foreground/30 absolute end-3 top-3 grid size-8 place-items-center rounded-full transition-colors'
        >
          <Navigation className='size-4' />
        </a>
      )}
    </div>
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
        <span
          className={cn('absolute inset-y-0 start-0 rounded-full', lit)}
          style={{ width: `${(free / total) * 100}%` }}
        />
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
