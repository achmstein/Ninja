import { Ban, Search, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from '@/components/branch-switcher'

/** The one line that says ordering is off at this branch; every composition shows it first. */
export function OrderingPausedNote({ className }: { className?: string }) {
  const t = useT()
  return (
    <div
      className={cn(
        'bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
        className
      )}
    >
      <Ban className='h-4 w-4 shrink-0' />
      {t('orderingUnavailable')}
    </div>
  )
}

/** The menu's search box: a magnifier at the start, a clear button at the end once something is typed. */
export function MenuSearchInput({
  value,
  onChange,
  className,
  inputClassName,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  inputClassName?: string
  autoFocus?: boolean
}) {
  const t = useT()
  return (
    <div className={cn('relative', className)}>
      <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2' />
      <Input
        className={cn('rounded-(--radius-round) pe-9 ps-9', inputClassName)}
        placeholder={t('searchMenu')}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type='button'
          aria-label={t('cancel')}
          className='text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2'
          onClick={() => onChange('')}
        >
          <X className='h-4 w-4' />
        </button>
      )}
    </div>
  )
}

/**
 * Where the customer is and which branch: the chips a phone's top bar
 * carries. A composition that draws its own masthead puts them in it; the
 * desktop header has its own.
 */
export function PlaceChips({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2 empty:hidden md:hidden', className)}>
      <DestinationChip />
      <BranchSwitcher />
    </div>
  )
}
