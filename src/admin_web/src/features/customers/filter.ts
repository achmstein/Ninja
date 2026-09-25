import { type TenantFeatures } from '@/api/tenant'

/**
 * The customer list's narrowed views: two belong to a module, and the
 * guests — people who ordered without an account — are always there.
 */
export type CustomerFilter = 'owing' | 'members' | 'guests'

/**
 * Which view the page may actually show. A link saved before the plan
 * changed — /customers?filter=owing with house accounts gone — is the
 * whole list, not an empty one or a page that asks a service the café no
 * longer pays for.
 */
export function allowedFilter(
  filter: CustomerFilter | undefined,
  features: Pick<TenantFeatures, 'tabs' | 'loyalty'>
): CustomerFilter | undefined {
  if (filter === 'owing' && !features.tabs) return undefined
  if (filter === 'members' && !features.loyalty) return undefined
  return filter
}
