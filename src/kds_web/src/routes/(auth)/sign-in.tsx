import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { useTheme } from '@/context/theme-provider'
import { useBrandName } from '@/lib/brand'
import { PoweredBy } from '@/components/ninja-wordmark'
import { useLanguage } from '@/lib/i18n'
import { loginPageParams } from '@/config/oidc-config'
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
import { BrandMark } from '@/components/brand-mark'

const searchSchema = z.object({
  redirect: z.string().optional(),
  // Sent by the 401 handler: the stored token was rejected, re-authenticate
  expired: z.boolean().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
})

/**
 * Keycloak is the only identity provider, so there is nothing to choose on a
 * sign-in page. Unauthenticated visitors are sent straight to Keycloak and
 * only ever see a branded splash; a card with a retry button appears only if
 * the sign-in actually fails. Same flow as admin_web.
 */
function SignIn() {
  const t = useT()
  const cafe = useBrandName()
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
      <div className='grid h-svh place-items-center p-4'>
        <Card className='w-full max-w-sm gap-4'>
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
      </div>
    )
  }

  return (
    <div className='flex h-svh flex-col items-center justify-center gap-8'>
      <div className='flex flex-col items-center gap-3'>
        <BrandMark className='size-14 text-2xl' />
        <div className='flex flex-col items-center gap-1'>
          <span className='text-2xl font-semibold tracking-tight'>
            {cafe || t('appName')}
          </span>
          {cafe && <span className='text-muted-foreground'>{t('appName')}</span>}
        </div>
      </div>
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        {t('redirectingToSignIn')}
      </div>
      <PoweredBy className='fixed bottom-6' />
    </div>
  )
}
