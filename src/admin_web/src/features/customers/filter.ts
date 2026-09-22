import { type TenantFeatures } from '@/api/branch'

/** The customer list's two narrowed views, each belonging to a module. */
export type CustomerFilter = 'owing' | 'members'

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
