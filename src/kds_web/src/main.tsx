import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@ninja/web-core/theme'
import { bootBrand } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthProvider } from './context/auth-provider'
import { DirectionProvider } from './context/direction-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import 'sileo/styles.css'
import './styles/index.css'
// Registers the axios instance every generated client sends through (@ninja/api)
import '@/lib/api-client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount > 3) return false
        return !(error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0))
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
  // '/' everywhere the app is served; a folder where it is shown inside another site (the home page's demo)
  basepath: import.meta.env.BASE_URL,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  // Screen changes cross-fade instead of snapping. Deliberately brief (see
  // styles/index.css): a cashier crosses these screens hundreds of times a
  // shift, so the transition has to read as polish, never as waiting. The
  // browser skips it entirely where the API is unsupported.
  defaultViewTransition: true,
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
          {/* A kitchen screen is easier on the eyes dark; staff can still flip it */}
          <ThemeProvider defaultTheme='dark'>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AuthProvider>
    </StrictMode>
  )
}
