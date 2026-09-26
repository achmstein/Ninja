import { DirectionProvider } from '@radix-ui/react-direction'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useBrandEffects } from '@/lib/brand'
import { useClaimGuestOrders } from '@/lib/use-claim-guest'
import { useHub } from '@/lib/hub'
import { useLanguage } from '@/lib/i18n'
import { usePushRegistration } from '@/lib/use-push'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
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

/**
 * The island (lib/island.ts): one sileo pill in the top bar's end corner
 * (the right, or the left in Arabic), where the place chips are; they step
 * aside while it is up. Collapsed it is small; a tap opens it (sileo opens
 * on hover, which a tap is on a phone), and something new opens it on its
 * own for a moment (autopilot) before it collapses again. A toast is 40 px
 * tall, so 12 px down the 64 px bar centres it. Sileo takes its fill from
 * the theme given, the app's resolved one, so it is painted opposite the
 * page as the dock is.
 */
function AppToaster() {
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  return (
    <Toaster
      position={language === 'ar' ? 'top-left' : 'top-right'}
      theme={resolvedTheme}
      offset={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 16, left: 16 }}
      options={{ autopilot: true }}
    />
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
