import { type ShiftView } from '@/api/sales'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetBody,
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
      <SheetContent className='sm:max-w-lg'>
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

        <SheetBody>{shift && <ShiftReport shift={shift} />}</SheetBody>
      </SheetContent>
    </Sheet>
  )
}
