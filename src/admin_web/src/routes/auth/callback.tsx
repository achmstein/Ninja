import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/error-state'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const t = useT()
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.isAuthenticated) {
      const redirect = sessionStorage.getItem('auth_redirect')
      sessionStorage.removeItem('auth_redirect')
      navigate({ to: redirect || '/', replace: true })
    }
  }, [auth.isAuthenticated, navigate])

  if (auth.error) {
    return (
      <ErrorState
        size='screen'
        title={t('signInFailed')}
        description={auth.error.message}
        actions={
          <Button onClick={() => navigate({ to: '/sign-in', replace: true })}>
            {t('backToSignIn')}
          </Button>
        }
      />
    )
  }

  return (
    <div className='flex h-svh items-center justify-center'>
      <Spinner className='size-8' />
    </div>
  )
}
