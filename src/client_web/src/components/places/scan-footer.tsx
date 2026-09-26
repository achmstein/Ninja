import { Armchair } from 'lucide-react'
import { useT } from '@/lib/i18n'

/** Under the places to book, so tables are not a secret in a branch that
 *  has rooms: the way to a table is the code on it. */
export function ScanFooter() {
  const t = useT()
  return (
    <div className='border-border flex items-center gap-3 rounded-[1.5rem] border-2 border-dashed p-4'>
      <span className='bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full'>
        <Armchair className='size-5' />
      </span>
      <div className='min-w-0'>
        <div className='text-[15px] font-semibold'>{t('atTableQuestion')}</div>
        <div className='text-muted-foreground text-[13px]'>{t('atTableScanHint')}</div>
      </div>
    </div>
  )
}
