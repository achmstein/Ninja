import { useEffect, useRef } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTheme } from '@/context/theme-provider'
import { useLanguage } from '@/lib/i18n'
import { loginPageParams } from '@/config/oidc-config'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '../auth-layout'

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
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const redirectStarted = useRef(false)

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate({ to: redirect || '/', replace: true })
    }
  }, [auth.isAuthenticated, navigate, redirect])

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
        <img
          src='/images/cup.png'
          alt=''
          className='size-14 object-contain dark:invert'
        />
        <span className='text-2xl font-semibold tracking-tight'>Chillax</span>
      </div>
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        {t('redirectingToSignIn')}
      </div>
    </div>
  )
}
