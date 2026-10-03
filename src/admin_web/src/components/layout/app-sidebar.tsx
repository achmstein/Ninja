import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { PoweredBy } from '@/components/ninja-wordmark'
import { BranchSwitcher } from './branch-switcher'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { useNavGroups } from './use-nav-groups'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const navGroups = useNavGroups()

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
