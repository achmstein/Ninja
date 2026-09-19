import { useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { loginPageParams } from '@/config/oidc-config'
import { RefreshCw } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useLanguage, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { AuthLayout } from '../auth-layout'
import { PLATFORM_NAME } from '@/lib/brand'
import { PlatformMark } from '@/components/platform-mark'

/**
 * Keycloak is the only identity provider, so there is nothing to choose on a
 * sign-in page. Unauthenticated visitors are sent straight to Keycloak and
 * only ever see a branded splash; a card with a retry button appears only if
 * the sign-in actually fails.
 */
export function SignIn() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((state) => state.language)
  const navigate = useNavigate()
  const { redirect, expired } = useSearch({ from: '/(auth)/sign-in' })
  const redirectStarted = useRef(false)

  // A token the API rejected is dropped first, otherwise the local user
  // still counts as signed in and the app would bounce straight back to the
  // page that 401'd, forever.
  useEffect(() => {
    if (expired && auth.isAuthenticated) {
      auth.removeUser()
    }
  }, [expired, auth])

  useEffect(() => {
    if (auth.isAuthenticated && !expired) {
      navigate({ to: redirect || '/', replace: true })
    }
  }, [auth.isAuthenticated, expired, navigate, redirect])

  const beginSignIn = () => {
    if (redirect) {
      sessionStorage.setItem('auth_redirect', redirect)
    }
    auth.signinRedirect(loginPageParams(resolvedTheme, language))
  }

  useEffect(() => {
    if (
      auth.isLoading ||
      auth.isAuthenticated ||
      auth.error ||
      auth.activeNavigator ||
      redirectStarted.current
    ) {
      return
    }
    redirectStarted.current = true
    if (redirect) {
      sessionStorage.setItem('auth_redirect', redirect)
    }
    auth.signinRedirect(loginPageParams(resolvedTheme, language))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoading, auth.isAuthenticated, auth.error, auth.activeNavigator])

  if (auth.error) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader className='text-center'>
            <CardTitle className='text-xl tracking-tight'>
              {t('signInFailed')}
            </CardTitle>
            <CardDescription>{auth.error.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={beginSignIn} size='lg' className='w-full'>
              <RefreshCw className='me-2 h-4 w-4' />
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <div className='flex h-svh flex-col items-center justify-center gap-8'>
      <div className='flex flex-col items-center gap-3'>
        <PlatformMark className='size-14 text-2xl' />
        <span className='text-2xl font-semibold tracking-tight'>
          {PLATFORM_NAME}
        </span>
      </div>
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Spinner />
        {t('redirectingToSignIn')}
      </div>
    </div>
  )
}
