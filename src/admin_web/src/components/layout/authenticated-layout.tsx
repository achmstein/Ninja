import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useRefreshPush } from '@/features/push/use-push'
import { useAdminNotifications } from '@/hooks/use-admin-notifications'
import { usePageTitle } from '@/hooks/use-page-title'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { BranchGate } from '@/components/branch-gate'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // Live order/room updates over SignalR for every admin page
  useAdminNotifications()

  // A device that opted into push keeps its subscription fresh
  useRefreshPush()

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
            {/* One sticky header for every page; pages own their PageHeader */}
            <Header />
            <BranchGate>{children ?? <Outlet />}</BranchGate>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
