import { Ban } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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
