import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { BranchGate } from '@/components/branch-gate'
import { SkipToMain } from '@/components/skip-to-main'
import { useAdminNotifications } from '@/hooks/use-admin-notifications'
import { usePageTitle } from '@/hooks/use-page-title'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // Live order/room updates over SignalR for every admin page
  useAdminNotifications()

  // "Orders · Chillax"-style browser-tab titles
  usePageTitle()

  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            <BranchGate>{children ?? <Outlet />}</BranchGate>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
