import type { ReactNode } from 'react'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import { oidcConfig } from '@/config/oidc-config'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <OidcAuthProvider {...oidcConfig}>{children}</OidcAuthProvider>
}
