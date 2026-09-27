import { DirectionProvider } from '@radix-ui/react-direction'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useBrand, useBrandEffects } from '@/lib/brand'
import { useClaimGuestOrders } from '@/lib/use-claim-guest'
import { useHub } from '@/lib/hub'
import { useLanguage } from '@/lib/i18n'
import { usePushRegistration } from '@/lib/use-push'
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
        {/* One layout at every width: the phone's column, and on a wide screen that same column
            centred on a tinted page (styles/index.css), its bars and dock kept to it */}
        <div className='bg-background mx-auto flex min-h-svh w-full max-w-lg flex-col pt-[env(safe-area-inset-top)] md:shadow-[0_0_60px_-20px_rgb(0_0_0/0.25)]'>
          {/* Installed (standalone) PWA: opaque strip under the notch/status
              bar so scrolled content doesn't show through behind it */}
          <div className='bg-background fixed inset-x-0 top-0 z-50 mx-auto h-[env(safe-area-inset-top)] max-w-lg' />
          <main className='w-full flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]'>
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
 * (the right, or the left in Arabic), where the scan and branch buttons
 * are; they step aside while it is up. Collapsed it is small; a tap opens
 * it (sileo opens on hover, which a tap is on a phone), and something new
 * opens it on its own for a moment (autopilot) before it collapses again.
 * A toast is 40 px tall, so 12 px down the 64 px bar centres it. It is the
 * dock's slab on either scheme, in the café's colour, and its kinds wear
 * the app's colours (styles/index.css).
 */
function AppToaster() {
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  // Re-read when the scheme or the café's colours change, so the pill follows them
  useBrand()
  // The slab's colour as it resolves now (the café's deep shade, raised on a dark page): sileo takes a
  // colour, not a variable, for the pill it draws
  const slab = typeof document === 'undefined' ? undefined : getComputedStyle(document.documentElement).getPropertyValue('--slab').trim() || undefined
  return (
    <Toaster
      key={`${resolvedTheme}-${slab}`}
      position={language === 'ar' ? 'top-left' : 'top-right'}
      // Sileo's "light" is its dark pill with light text: the dock's, on either scheme
      theme='light'
      // In the column's corner, which on a wide screen is not the window's
      offset={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: COLUMN_EDGE, left: COLUMN_EDGE }}
      options={{ autopilot: true, fill: slab }}
    />
  )
}

/** 16 px in from the edge of the app's column (32rem wide, centred), however wide the window */
const COLUMN_EDGE = 'max(16px, calc((100vw - 32rem) / 2 + 16px))'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
