import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { getStoredUser, loginPageParams } from '@/config/oidc-config'
import { useTheme } from '@/context/theme-provider'
import { useLanguage, useT } from '@/lib/i18n'
import { claimSignInRetry } from '@/lib/sign-in-retry'
import { pickedSomeoneElse } from '@/features/cashiers/roster'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const t = useT()
  const auth = useAuth()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((state) => state.language)
  // The error is shown only once the till's own second try has failed too
  const [showError, setShowError] = useState(false)
  const handled = useRef(false)

  useEffect(() => {
    if (auth.isAuthenticated) {
      // A name was tapped on the signed-out screen and somebody else came
      // back: Keycloak still held their session and asked nothing. They are
      // signed out (which ends that session), and the names show again
      if (pickedSomeoneElse(auth.user?.profile)) {
        void auth.signoutRedirect()
        return
      }
      const redirect = sessionStorage.getItem('auth_redirect')
      sessionStorage.removeItem('auth_redirect')
      navigate({ to: redirect || '/', replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, navigate])

  const signInAgain = () =>
    auth.signinRedirect(loginPageParams(resolvedTheme, language))

  useEffect(() => {
    if (!auth.error || auth.isAuthenticated || handled.current) return
    handled.current = true
    // This page loaded twice with the same answer (a reload half-way
    // through): the first load signed in, the second finds its answer
    // spent. The sign-in is there all the same, so the till opens on it
    const stored = getStoredUser()
    if (stored && !stored.expired) {
      const redirect = sessionStorage.getItem('auth_redirect')
      sessionStorage.removeItem('auth_redirect')
      window.location.replace(redirect || import.meta.env.BASE_URL)
      return
    }
    // Otherwise what Try again did: Keycloak is asked afresh, once (lib/sign-in-retry.ts)
    if (claimSignInRetry()) void signInAgain()
    else setShowError(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.error, auth.isAuthenticated])

  if (auth.error && showError) {
    return (
      <div className='flex h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
        <h1 className='text-2xl font-bold'>{t('signInFailed')}</h1>
        <p className='text-muted-foreground'>{auth.error.message}</p>
        <Button size='lg' onClick={() => void signInAgain()}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className='flex h-svh items-center justify-center'>
      <Loader2 className='h-8 w-8 animate-spin' />
    </div>
  )
}
