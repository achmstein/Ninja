import { useQuery } from '@tanstack/react-query'
import { isOwner } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getTalabatOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { getCourierProvidersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { type TenantFeatures } from '@/api/tenant/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'

/**
 * What the business runs, in one place: its switched modules, what the kind
 * of place rules out, and the two connections that are not switches (Talabat,
 * courier companies).
 *
 * The rule every page follows with it: a module that is off offers nothing
 * (no link, filter, option, setting or empty row of its own), but what it
 * recorded while it was on still shows wherever that record belongs, so money
 * that happened is never hidden because a switch moved since.
 */
export type Modules = TenantFeatures & {
  /** Tables and rooms exist at all: not a cloud kitchen */
  places: boolean
  /** Rooms billed by the time: time billing, somewhere with places */
  rooms: boolean
  /** The platform connected the business to Talabat: its page, where the owner picks the branches, is offered (owner only) */
  talabatConnected: boolean
  /** Connected, and a branch sells there: Talabat's tender and figures are offered (owner only; false for anyone else) */
  talabat: boolean
  /** Delivery is on and the business lists a courier company it has switched on */
  couriers: boolean
}

const q = { query: { 'api-version': API_VERSION } }

export function useModules(): Modules {
  const features = useFeatures()
  const cloudKitchen = useIsCloudKitchen()
  const auth = useAuth()
  const owner = isOwner(auth.user)

  // Talabat's state is the owner's to read; for anyone else its controls stay away
  const talabat = useQuery({
    ...getTalabatOptions(q),
    enabled: owner,
    staleTime: 5 * 60_000,
  })
  const couriers = useQuery({
    ...getCourierProvidersOptions(q),
    enabled: features.delivery === true,
    staleTime: 5 * 60_000,
  })

  return {
    ...features,
    places: !cloudKitchen,
    rooms: features.timeBilling === true && !cloudKitchen,
    talabatConnected: talabat.data?.connected === true,
    talabat: talabat.data?.connected === true && (talabat.data.branchIds?.length ?? 0) > 0,
    couriers: features.delivery === true && (couriers.data ?? []).some((c) => c.isActive),
  }
}
