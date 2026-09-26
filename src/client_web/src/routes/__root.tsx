import { DirectionProvider } from '@radix-ui/react-direction'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useBrandEffects } from '@/lib/brand'
import { useBrandLayout } from '@/lib/brand-layout'
import { useClaimGuestOrders } from '@/lib/use-claim-guest'
import { useHub } from '@/lib/hub'
import { useLanguage } from '@/lib/i18n'
import { usePushRegistration } from '@/lib/use-push'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { OrderPill } from '@/components/order-pill'

type RouterContext = {
  queryClient: QueryClient
}

function RootLayout() {
  // The tenant's name, color and icons on the page, and in the tab's language
  useBrandEffects()
  // One app-wide SignalR connection: order/room/branch events → refetches
  useHub()
  // Web push (no-op until the Firebase web config is provided)
  usePushRegistration()
  // A guest who signed in takes their orders and bills with them
  useClaimGuestOrders()

  // Radix components don't read the document's dir attribute — without this
  // provider they render dir="ltr" and force their subtree LTR in Arabic
  const language = useLanguage((s) => s.language)

  return (
    <DirectionProvider dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <ThemeProvider>
        <div className='flex min-h-svh flex-col pt-[env(safe-area-inset-top)]'>
          {/* Installed (standalone) PWA: opaque strip under the notch/status
              bar so scrolled content doesn't show through behind it */}
          <div className='bg-background fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)]' />
          <AppHeader />
          <MobileTopBar />
          <main className='mx-auto w-full max-w-lg flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-6xl md:pb-8'>
            <Outlet />
          </main>
          <BottomNav />
          {/* The order just placed, live at the top of every page */}
          <OrderPill />
          <AppToaster />
        </div>
      </ThemeProvider>
    </DirectionProvider>
  )
}

// Sileo derives the toast pill fill from its theme prop — keep it in sync
// with the app's resolved theme (not just the OS preference). Autopilot is
// the demo's expand/collapse physics for title + description toasts.
function AppToaster() {
  const { resolvedTheme } = useTheme()
  // The Counter chrome: toasts drop in just under the slim top bar (the
  // order pill owns the bar's middle, the dock owns the bottom). Sileo
  // already paints them opposite the page, as the dock is painted
  const counter = useBrandLayout().chrome === 'counter'
  return (
    <Toaster
      position='top-center'
      theme={resolvedTheme}
      offset={counter ? { top: 'calc(env(safe-area-inset-top) + 72px)' } : undefined}
      options={{ autopilot: true }}
    />
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
