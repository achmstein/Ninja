import { type ShiftView } from '@/api/sales'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { formatWhen } from '@/lib/when'
import { EntitySheet } from '@/components/entity-sheet'
import { StatusChip } from '@/components/status-chip'
import { ShiftReport } from './shift-report'

type ShiftSheetProps = {
  shift: ShiftView | null
  onOpenChange: (open: boolean) => void
}

/** One shift's X or Z report, as the till prints it, in a side sheet. */
export function ShiftSheet({ shift, onOpenChange }: ShiftSheetProps) {
  const t = useT()
  const locale = useLocale()
  const closed = shift?.status === 'Closed'

  return (
    <EntitySheet
      open={shift != null}
      onOpenChange={onOpenChange}
      title={t('shiftNumber', { id: toNumber(shift?.id) })}
      status={
        shift && (
          <StatusChip tone={closed ? 'muted' : 'success'}>
            {t(closed ? 'shiftClosedBadge' : 'shiftOpenBadge')}
          </StatusChip>
        )
      }
      subtitle={
        shift?.openedAt
          ? `${t('openedAt')} ${formatWhen(shift.openedAt, 'dateTime', locale, t)}${shift.openedBy ? ` · ${shift.openedBy}` : ''}`
          : undefined
      }
    >
      {shift && <ShiftReport shift={shift} />}
    </EntitySheet>
  )
}
