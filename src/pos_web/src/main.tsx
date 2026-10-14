import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { getStoredUser } from '@/config/oidc-config'
import { bootBrand } from '@/lib/brand'
import { keepPersistedQueries, queryPersistOptions } from '@/lib/query-persist'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthProvider } from './context/auth-provider'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
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
      if (error instanceof AxiosError && error.response?.status === 401) {
        // A token that ran out while the till was offline is renewed by the
        // signed-in gate as soon as the server is back; the calls that beat
        // it there are not a reason to send the cashier to sign in
        if (getStoredUser()?.expired) return
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

keepPersistedQueries(queryClient)

// Create a new router instance
const router = createRouter({
  routeTree,
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
  // The app itself loads with the internet down: the service worker keeps
  // the shell (vite.config.ts). Dev serves modules live, so only a build has one.
  if (import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }
  await bootBrand(queryClient)
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <AuthProvider>
        {/* The menu, the branches and their pricing come back from the last
            visit before the network answers: a till that reloads with the
            internet down can still sell (lib/query-persist.ts) */}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={queryPersistOptions}
        >
          <ThemeProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </AuthProvider>
    </StrictMode>
  )
}
