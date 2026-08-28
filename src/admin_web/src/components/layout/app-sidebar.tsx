import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { getRealmRoles } from '@/config/oidc-config'
import { serviceRequestsService } from '@/features/requests/service'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { BranchSwitcher } from './branch-switcher'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  // Pending-order count badge on Live Orders, kept fresh by SignalR
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
    '/orders/board': pendingOrders.length,
    '/requests': serviceRequests.length,
  }

  const navGroups = sidebarData.navGroups
    .filter((group) => !group.ownerOnly || isOwner)
    .map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const count = item.url ? badges[String(item.url)] : undefined
        return count ? { ...item, badge: String(count) } : item
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
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
