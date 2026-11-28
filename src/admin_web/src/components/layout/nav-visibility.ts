import { getRealmRoles } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { entitledTo, useBrand } from '@/lib/brand'
import { useModules, type Modules } from '@/lib/modules'
import { type NavGroup, type NavItem } from './types'

/** Who is looking and what the business runs: everything a nav entry is shown by */
export type NavContext = {
  isOwner: boolean
  modules: Modules
  entitled: (key: NonNullable<Extract<NavItem, { url: unknown }>['entitled']>) => boolean
}

export function useNavContext(): NavContext {
  const auth = useAuth()
  const brand = useBrand()
  const modules = useModules()
  return {
    isOwner: getRealmRoles(auth.user).includes('Owner'),
    modules,
    entitled: (key) => brand != null && entitledTo(brand, key),
  }
}

type Rules = {
  ownerOnly?: boolean
  feature?: keyof Modules
  needsPlaces?: boolean
  connection?: 'talabat'
}

/** One entry's rules against the context: the sidebar, the phone's More and Go to… all ask this */
export function shownBy(rules: Rules, ctx: NavContext): boolean {
  return (
    (!rules.ownerOnly || ctx.isOwner) &&
    (!rules.feature || ctx.modules[rules.feature] === true) &&
    (!rules.needsPlaces || ctx.modules.places) &&
    (rules.connection !== 'talabat' || ctx.modules.talabatConnected)
  )
}

/** A group's entries this person sees; a group left with nothing goes too */
export function visibleNav(groups: NavGroup[], ctx: NavContext): NavGroup[] {
  return groups
    .filter((group) => shownBy(group, ctx))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.items != null || (shownBy(item, ctx) && (!item.entitled || ctx.entitled(item.entitled)))
      ),
    }))
    .filter((group) => group.items.length > 0)
}
