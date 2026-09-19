import { useMemo, type ReactNode } from 'react'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import { getOidcConfig } from '@/config/oidc-config'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Built once, after bootBrand() has cached the tenant's authority
  const config = useMemo(() => getOidcConfig(), [])
  return (
    <OidcAuthProvider {...config}>
      {children}
    </OidcAuthProvider>
  )
}
