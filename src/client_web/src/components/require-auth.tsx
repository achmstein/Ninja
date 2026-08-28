import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { SignInOptions } from '@/components/sign-in-options'
import { useT } from '@/lib/i18n'

// Wraps pages that need a signed-in customer. Browsing stays public.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const t = useT()

  if (auth.isLoading) {
    return (
      <div className='text-muted-foreground flex h-[60svh] items-center justify-center gap-2'>
        <Loader2 className='h-4 w-4 animate-spin' />
        {t('loading')}
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div className='flex h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center'>
        <p className='text-muted-foreground'>{t('signInPrompt')}</p>
        <SignInOptions />
      </div>
    )
  }

  return <>{children}</>
}
