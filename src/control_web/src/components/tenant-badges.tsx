import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n'
import {
  kindLabelKey,
  statusLabelKey,
  tenantKind,
  tenantStatus,
  type TenantStatusName,
} from '@/lib/tenant'
import { cn } from '@/lib/utils'

// The one place colour means something: green is up, amber is in motion,
// red needs a look, grey is off.
const statusClass: Record<TenantStatusName, string> = {
  Running:
    'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Provisioning:
    'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Requested:
    'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Destroying:
    'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Failed: 'border-transparent bg-destructive/15 text-destructive',
  Stopped: 'border-transparent bg-muted text-muted-foreground',
  Destroyed: 'border-transparent bg-muted text-muted-foreground',
}

export function StatusBadge({
  status,
  className,
}: {
  status: number | string
  className?: string
}) {
  const t = useT()
  const name = tenantStatus(status)
  return (
    <Badge variant='outline' className={cn(statusClass[name], className)}>
      {t(statusLabelKey[name])}
    </Badge>
  )
}

export function KindBadge({ kind }: { kind: number | string }) {
  const t = useT()
  const name = tenantKind(kind)
  return (
    <Badge variant={name === 'Customer' ? 'default' : 'secondary'}>
      {t(kindLabelKey[name])}
    </Badge>
  )
}
