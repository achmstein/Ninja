import { useMemo, type ReactNode } from 'react'
import { getOidcConfig } from '@/config/oidc-config'
import { SessionProvider } from './session'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Built once, after bootBrand() has cached the tenant's authority
  const config = useMemo(() => getOidcConfig(), [])
  return <SessionProvider config={config}>{children}</SessionProvider>
}
