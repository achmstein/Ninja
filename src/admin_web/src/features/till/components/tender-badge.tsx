import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { tenderLabelKey } from './tender'

export function TenderBadge({ tender }: { tender: string | null | undefined }) {
  const t = useT()
  const key = tenderLabelKey(tender)
  return (
    <Badge variant={tender === 'Cash' ? 'secondary' : 'outline'}>
      {key ? t(key) : tender || '—'}
    </Badge>
  )
}
