import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { AuthProvider } from 'react-oidc-context'
import { bootBrand } from './lib/brand'
import { App } from './app'
import { getOidcConfig } from './lib/oidc'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import 'sileo/styles.css'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 2,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render once the brand (name, color, icons) is on the page: from the last
// visit's cache at once, or from the network on a first visit
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  await bootBrand(queryClient)
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <AuthProvider {...getOidcConfig()}>
        <QueryClientProvider client={queryClient}>
          <App router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </StrictMode>
  )
}
