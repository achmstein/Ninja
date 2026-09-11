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
        // Session expired: go straight to sign-in, no toast. Every failed
        // query fires onError, so a burst of parallel 401s would otherwise
        // stack toasts; the pathname guard also keeps it to a single redirect.
        if (router.state.location.pathname !== '/sign-in') {
          const redirect = `${router.history.location.href}`
          router.navigate({ to: '/sign-in', search: { redirect } })
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

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
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
