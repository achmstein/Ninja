import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
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
      <div className='flex h-svh flex-col items-center justify-center gap-4'>
        <h1 className='text-2xl font-bold'>Sign-in failed</h1>
        <p className='text-muted-foreground'>{auth.error.message}</p>
        <Button onClick={() => navigate({ to: '/sign-in', replace: true })}>
          Back to sign in
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
