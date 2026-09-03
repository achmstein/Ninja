import { type ShiftView } from '@/api/sales'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ShiftReport } from './shift-report'

type ShiftSheetProps = {
  shift: ShiftView | null
  onOpenChange: (open: boolean) => void
}

/** One shift's X or Z report, as the till prints it, in a side sheet. */
export function ShiftSheet({ shift, onOpenChange }: ShiftSheetProps) {
  const t = useT()
  const locale = useLocale()
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const closed = shift?.status === 'Closed'

  return (
    <Sheet open={shift != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <div className='flex items-center gap-2'>
            <SheetTitle>
              {t('shiftNumber', { id: toNumber(shift?.id) })}
            </SheetTitle>
            {shift && (
              <Badge variant={closed ? 'secondary' : 'default'}>
                {t(closed ? 'shiftClosedBadge' : 'shiftOpenBadge')}
              </Badge>
            )}
          </div>
          <SheetDescription>
            {shift?.openedAt
              ? `${t('openedAt')} ${dateTime.format(new Date(shift.openedAt))}${shift.openedBy ? ` · ${shift.openedBy}` : ''}`
              : ' '}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 px-4 pb-4'>
          {shift && <ShiftReport shift={shift} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
