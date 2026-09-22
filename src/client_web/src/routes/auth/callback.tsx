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
      navigate({ to: '/', replace: true })
    }
  }, [auth.isAuthenticated, navigate])

  if (auth.error) {
    return (
      <div className='flex h-svh flex-col items-center justify-center gap-3 px-6 text-center'>
        <p className='font-semibold'>Sign-in failed</p>
        <p className='text-muted-foreground text-sm'>{auth.error.message}</p>
        <Button
          className='rounded-pill px-8'
          onClick={() => navigate({ to: '/', replace: true })}
        >
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className='flex h-svh items-center justify-center'>
      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
    </div>
  )
}
