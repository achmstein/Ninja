import { Armchair } from 'lucide-react'
import { useT } from '@/lib/i18n'

/** Under the booking list, so tables are not a secret in a branch that has
 *  rooms: the way to a table is the code on it. */
export function ScanFooter() {
  const t = useT()
  return (
    <div className='border-muted-foreground/30 mt-2 flex items-center gap-3 rounded-xl border border-dashed p-4'>
      <Armchair className='text-muted-foreground h-6 w-6 shrink-0' />
      <div className='min-w-0'>
        <div className='text-sm font-bold'>{t('atTableQuestion')}</div>
        <div className='text-muted-foreground text-[13px]'>
          {t('atTableScanHint')}
        </div>
      </div>
    </div>
  )
}
