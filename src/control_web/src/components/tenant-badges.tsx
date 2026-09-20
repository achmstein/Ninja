import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n'
import {
  kindLabelKey,
  statusLabelKey,
  subscriptionLabelKey,
  subscriptionStatus,
  tenantKind,
  tenantStatus,
  type SubscriptionStatusName,
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
  Upgrading:
    'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Failed: 'border-transparent bg-destructive/15 text-destructive',
  Suspended: 'border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-400',
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

// Where the café stands with its money: quiet while it is fine, amber when a period ran out, rose when the stack is stopped for it
const subscriptionClass: Record<SubscriptionStatusName, string> = {
  Trialing: 'border-transparent bg-muted text-muted-foreground',
  Active: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  PastDue: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Suspended: 'border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-400',
  Cancelled: 'border-transparent bg-muted text-muted-foreground',
}

export function SubscriptionBadge({ status, className }: { status: number | string; className?: string }) {
  const t = useT()
  const name = subscriptionStatus(status)
  return (
    <Badge variant='outline' className={cn(subscriptionClass[name], className)}>
      {t(subscriptionLabelKey[name])}
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
