import { motion } from 'motion/react'
import { Check, LocateFixed, Loader2, MapPin, Navigation } from 'lucide-react'
import { type BranchResponse } from '@/api/tenant'
import { branchState, type BranchState } from '@/lib/branch'
import { directionsUrl, pointOf, useDistance, type useMyLocation } from '@/lib/geo'
import { useBranchesByDistance, useBranchSwitch } from '@/lib/use-branch-switch'
import { useBranchStore } from '@/stores/branch-store'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { springOpen } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const STATE_META: Record<BranchState, { key: TranslationKey; dot: string }> = {
  open: { key: 'branchOpen', dot: 'bg-emerald-500' },
  notOrdering: { key: 'branchNotOrdering', dot: 'bg-amber-500' },
  closed: { key: 'branchClosed', dot: 'bg-muted-foreground' },
}

/** A branch's quiet facts on one line: open or not, and how far */
export function BranchFacts({ branch, meters, className }: { branch: BranchResponse; meters: number | null; className?: string }) {
  const t = useT()
  const distance = useDistance()
  const state = STATE_META[branchState(branch)]
  return (
    <span className={cn('text-muted-foreground flex items-center gap-1.5 text-caption', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', state.dot)} aria-hidden />
      <span>{t(state.key)}</span>
      {meters != null && (
        <>
          <span aria-hidden>·</span>
          <span className='tabular-nums' dir='ltr'>
            {distance(meters)}
          </span>
        </>
      )}
    </span>
  )
}

/** The way there in Google Maps, for a branch the owner put on the map */
export function DirectionsLink({ branch, className }: { branch: BranchResponse; className?: string }) {
  const t = useT()
  const point = pointOf(branch)
  if (!point) return null
  return (
    <a
      href={directionsUrl(point)}
      target='_blank'
      rel='noopener noreferrer'
      onClick={(e) => e.stopPropagation()}
      className={cn('bg-muted active:bg-muted/70 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-semibold transition-colors', className)}
    >
      <Navigation className='size-3.5' />
      {t('directions')}
    </a>
  )
}

/** "Use my location", quiet, for a customer who said no or was not asked: a tap asks then */
export function UseMyLocation({ location, className }: { location: ReturnType<typeof useMyLocation>; className?: string }) {
  const t = useT()
  if (location.here) return null
  if (location.locating) {
    return (
      <span className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-caption', className)}>
        <Loader2 className='size-3.5 animate-spin' />
        {t('locating')}
      </span>
    )
  }
  if (!location.canLocate) return null
  return (
    <button
      type='button'
      onClick={location.locate}
      className={cn('text-muted-foreground active:text-foreground inline-flex items-center gap-1.5 text-caption font-semibold transition-colors', className)}
    >
      <LocateFixed className='size-3.5' />
      {t('useMyLocation')}
    </button>
  )
}

/**
 * The branches as a sheet from the bottom, the one looked at lit: closest
 * first when the customer let the app know where they are, each with how
 * far, whether it is open and the way there. A tap moves the app to it,
 * asking first when there are dishes in the order. Any page opens it
 * (the You page, booking); the position is asked for only once it is open.
 */
export function BranchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const localized = useLocalized()
  const branchId = useBranchStore((s) => s.branchId)
  const { request, dialog } = useBranchSwitch()
  const { sorted, location, anyPoint } = useBranchesByDistance(open)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('selectBranch')}</SheetTitle>
            {anyPoint && sorted.length > 1 && <UseMyLocation location={location} className='self-start' />}
          </SheetHeader>
          <div className='flex flex-col gap-1.5' role='radiogroup'>
            {sorted.map(({ item: branch, meters }) => {
              const id = Number(branch.id)
              const on = id === branchId
              return (
                <div key={String(branch.id)} className='relative flex min-h-16 items-center gap-2 rounded-[1.25rem] pe-2'>
                  {on && (
                    <motion.span
                      layoutId='branch-on'
                      transition={springOpen}
                      aria-hidden
                      style={{ borderRadius: 20 }}
                      className='bg-muted absolute inset-0'
                    />
                  )}
                  <button
                    type='button'
                    role='radio'
                    aria-checked={on}
                    onClick={() => {
                      onOpenChange(false)
                      request(id)
                    }}
                    className='relative flex min-w-0 flex-1 items-center gap-3 py-3 ps-4 text-start'
                  >
                    <span className='bg-muted relative grid size-10 shrink-0 place-items-center rounded-full'>
                      <MapPin className='size-5' />
                    </span>
                    <span className='relative flex min-w-0 flex-1 flex-col'>
                      <span className='flex items-center gap-1.5 text-body font-semibold'>
                        <span className='truncate'>{localized(branch.name)}</span>
                        {on && <Check className='size-4 shrink-0' />}
                      </span>
                      {localized(branch.address) && <span className='text-muted-foreground truncate text-caption'>{localized(branch.address)}</span>}
                      <BranchFacts branch={branch} meters={meters} />
                    </span>
                  </button>
                  <DirectionsLink branch={branch} className={cn('relative', on && 'bg-background')} />
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  )
}
