import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { movementTypeKeys } from '../format'

// Waste stands out; the two halves of a transfer read as one pair
const variantByType: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  Waste: 'destructive',
  TransferOut: 'secondary',
  TransferIn: 'secondary',
}

export function MovementTypeBadge({
  type,
}: {
  type: string | null | undefined
}) {
  const t = useT()
  const key = type ? movementTypeKeys[type] : undefined
  return (
    <Badge variant={(type && variantByType[type]) || 'outline'}>
      {key ? t(key) : type || '—'}
    </Badge>
  )
}
