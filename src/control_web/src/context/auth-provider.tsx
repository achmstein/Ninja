import type { ReactNode } from 'react'
import { oidcConfig } from '@/config/oidc-config'
import { SessionProvider } from '@ninja/web-core/session'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider config={oidcConfig}>{children}</SessionProvider>
}
