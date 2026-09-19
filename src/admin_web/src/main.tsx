import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
// Styles
import 'sileo/styles.css'
import { bootBrand } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { AuthProvider } from './context/auth-provider'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
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
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
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
        if (error.response?.status === 500) {
          // Pages render their own ErrorState; the toast is for the
          // background queries (badges, polls) nobody is looking at
          toast.error(translate('somethingWentWrong'))
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
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app, once the brand (name, color, icons) is on the page: from
// the last visit's cache at once, or from the network on a first visit
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  await bootBrand(queryClient)
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AuthProvider>
    </StrictMode>
  )
}
