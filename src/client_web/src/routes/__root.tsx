import { DirectionProvider } from '@radix-ui/react-direction'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useHub } from '@/lib/hub'
import { useLanguage } from '@/lib/i18n'
import { usePushRegistration } from '@/lib/use-push'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'

type RouterContext = {
  queryClient: QueryClient
}

function RootLayout() {
  // One app-wide SignalR connection: order/room/branch events → refetches
  useHub()
  // Web push (no-op until the Firebase web config is provided)
  usePushRegistration()

  // Radix components don't read the document's dir attribute — without this
  // provider they render dir="ltr" and force their subtree LTR in Arabic
  const language = useLanguage((s) => s.language)

  return (
    <DirectionProvider dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <ThemeProvider>
        <div className='flex min-h-svh flex-col'>
          <AppHeader />
          <main className='mx-auto w-full max-w-lg flex-1 pb-20 md:max-w-6xl md:pb-8'>
            <Outlet />
          </main>
          <BottomNav />
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
  return (
    <Toaster
      position='top-center'
      theme={resolvedTheme}
      options={{ autopilot: true }}
    />
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
