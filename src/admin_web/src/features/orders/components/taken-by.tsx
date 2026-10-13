import { useQuery } from '@tanstack/react-query'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Who rang a till order up: "Taken by Sara", or "Taken by Sara at Downtown"
 * for a phone delivery another branch's till sent on to the branch that made
 * it. Nothing for an order from the apps. Branch names off the public list,
 * which has every branch, not only this account's.
 */
export function TakenBy({
  order,
  className,
}: {
  order: {
    takenByName?: string | null
    takenAtBranchId?: number | string | null
  }
  className?: string
}) {
  const t = useT()
  const localized = useLocalized()
  const { data: branches = [] } = useQuery(getBranchesOptions())
  if (!order.takenByName) return null
  const at =
    order.takenAtBranchId == null
      ? null
      : branches.find((b) => toNumber(b.id) === toNumber(order.takenAtBranchId))
  return (
    <span className={cn('text-muted-foreground text-xs', className)}>
      {order.takenAtBranchId == null
        ? t('orderTakenBy', { name: order.takenByName })
        : t('orderTakenByAt', {
            name: order.takenByName,
            branch: at ? localized(at.name) : t('unknownBranch'),
          })}
    </span>
  )
}
