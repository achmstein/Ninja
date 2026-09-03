import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { ticketTypeKey } from './tender'

export function TypeBadge({ type }: { type: string | null | undefined }) {
  const t = useT()
  const key = ticketTypeKey(type)
  return <Badge variant='outline'>{key ? t(key) : type || '—'}</Badge>
}
