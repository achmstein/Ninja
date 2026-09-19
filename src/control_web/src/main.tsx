import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthProvider } from './context/auth-provider'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import 'sileo/styles.css'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount > 3) return false
        return !(
          error instanceof AxiosError &&
          [401, 403, 404].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError && error.response?.status === 401) {
        // The API no longer accepts the token (expired, or Keycloak was
        // reset and the stored one is signed by a dead key). Sign-in drops
        // the stored user and re-authenticates instead of bouncing back
        // here on the strength of a token that only looks valid locally.
        // Every failed query fires onError, so the guard keeps a burst of
        // parallel 401s to a single redirect and no toast.
        if (router.state.location.pathname !== '/sign-in') {
          const redirect = `${router.history.location.href}`
          router.navigate({
            to: '/sign-in',
            search: { redirect, expired: true },
          })
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  // Screen changes cross-fade instead of snapping (see styles/index.css)
  defaultViewTransition: true,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DirectionProvider>
              <TooltipProvider>
                <RouterProvider router={router} />
              </TooltipProvider>
            </DirectionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AuthProvider>
    </StrictMode>
  )
}
