import type { ReactNode } from 'react'
import { oidcConfig } from '@/config/oidc-config'
import { SessionProvider } from './session'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider config={oidcConfig}>{children}</SessionProvider>
}
