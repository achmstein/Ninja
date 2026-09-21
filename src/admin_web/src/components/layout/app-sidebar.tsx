import { useQuery } from '@tanstack/react-query'
import { getRealmRoles } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { serviceRequestsService } from '@/features/requests/service'
import { BranchSwitcher } from './branch-switcher'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { PoweredBy } from '@/components/ninja-wordmark'
import { type NavItem } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')
  const features = useFeatures()

  // Pending-order count badge on Orders, kept fresh by SignalR
  const { data: pendingOrders = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })

  // Open service-request count badge on Requests, same freshness
  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => serviceRequestsService.pending(),
    refetchInterval: 60_000,
  })

  const badges: Record<string, number> = {
    '/orders': pendingOrders.length,
    '/requests': serviceRequests.length,
  }

  const withBadge = <T extends { url?: string }>(item: T): T => {
    const count = item.url ? badges[String(item.url)] : undefined
    return count ? { ...item, badge: String(count) } : item
  }

  // Owner-only pages stay off an admin's menu; switched-off features stay off everyone's
  const navGroups = sidebarData.navGroups
    .filter((group) => !group.ownerOnly || isOwner)
    .filter((group) => !group.feature || features[group.feature])
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => item.items || !item.ownerOnly || isOwner)
        .filter((item) => item.items || !item.feature || features[item.feature])
        .map((item): NavItem => {
          if (item.items) {
            return { ...item, items: item.items.map(withBadge) }
          }
          return withBadge(item)
        }),
    }))

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <BranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        {/* The vendor line; it has no place in the icon-only rail */}
        <PoweredBy className='justify-center pb-1 group-data-[collapsible=icon]:hidden' />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
