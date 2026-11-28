import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { getStoredUser } from '@/config/oidc-config'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { setSessionRenewer } from '@/lib/api-client'
import { bootBrand } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'
import { keepPersistedQueries, queryPersistOptions } from '@/lib/query-persist'
import { reloadForNewBuild } from '@/lib/stale-build'
import { AuthProvider } from './context/auth-provider'
import { DirectionProvider } from './context/direction-provider'
import { renewSession } from './context/session'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import 'sileo/styles.css'
import './styles/index.css'

// A screen whose code is gone since a release: onto the new release, once (lib/stale-build.ts)
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault()
})

// A call made on an expired sign-in waits for its renewal instead of being refused (lib/api-client.ts)
setSessionRenewer(renewSession)

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
  // The app itself loads with the internet down: the service worker keeps
  // the shell (vite.config.ts). Dev serves modules live, so only a build has one.
  // Not where the app is shown inside another site (the home page's demo): there the
  // page's own worker answers for the server, and this one would take the app from it
  if (import.meta.env.PROD && import.meta.env.BASE_URL === '/') {
    const { registerSW } = await import('virtual:pwa-register')
    // registerSW reloads the page onto a new release the moment it is in.
    // On the way back from Keycloak that reload lands half-way through the
    // sign-in: the answer in the address is spent by then, and the cashier
    // saw Sign-in failed (on an installed till most of all, which opens on
    // the old release every time one has shipped). There it waits until the
    // sign-in is done and the till has moved on
    const onCallback = () => router.state.location.pathname.endsWith('/auth/callback')
    if (!onCallback()) {
      registerSW({ immediate: true })
    } else {
      const stop = router.subscribe('onResolved', () => {
        if (onCallback()) return
        stop()
        registerSW({ immediate: true })
      })
    }
  }
  await bootBrand(queryClient)
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <AuthProvider>
        {/* The menu, the branches and their pricing come back from the last
            visit before the network answers: a till that reloads with the
            internet down can still sell (lib/query-persist.ts) */}
        <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
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
