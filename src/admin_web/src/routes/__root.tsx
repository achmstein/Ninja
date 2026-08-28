import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from 'sileo'
import { useDirection } from '@/context/direction-provider'
import { useTheme } from '@/context/theme-provider'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'

// Sileo only paints the pill background when it knows the theme (otherwise
// it falls back to a white fill that vanishes on light pages), and autopilot
// is the demo's expand/collapse physics for title + description toasts.
function AppToaster() {
  const { resolvedTheme } = useTheme()
  const { dir } = useDirection()
  return (
    <Toaster
      // Mirrored corner in RTL, like the rest of the layout
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      theme={resolvedTheme}
      options={{ autopilot: true }}
    />
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <AppToaster />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition='bottom-left' />
            {/* Keep away from bottom-right: that corner belongs to toasts */}
            <TanStackRouterDevtools position='bottom-left' />
          </>
        )}
      </>
    )
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
