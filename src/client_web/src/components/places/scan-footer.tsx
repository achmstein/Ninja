import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { TableScanner } from './table-scanner'

/** Under the places to book, so tables are not a secret in a branch that
 *  has rooms: a tap opens the scanner for the code on the table (or on a
 *  room, whose sheet it opens). */
export function ScanFooter() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='border-border active:bg-foreground/[0.04] flex w-full items-center gap-3 rounded-[1.5rem] border-2 border-dashed p-4 text-start transition-colors'
      >
        <span className='bg-muted grid size-10 shrink-0 place-items-center rounded-full'>
          <ScanLine className='size-5' />
        </span>
        <div className='min-w-0'>
          <div className='text-[15px] font-semibold'>{t('atTableQuestion')}</div>
          <div className='text-muted-foreground text-[13px]'>{t('atTableScanHint')}</div>
        </div>
      </button>
      <TableScanner open={open} onOpenChange={setOpen} />
    </>
  )
}
