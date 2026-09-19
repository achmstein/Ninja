import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { useTheme } from '@/context/theme-provider'
import { useLanguage } from '@/lib/i18n'
import { loginPageParams } from '@/config/oidc-config'
import { LogIn } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/(auth)/signed-out')({
  component: SignedOut,
})

/**
 * Post-logout landing page. Keycloak sends the browser here after sign-out,
 * so the user gets a resting page instead of being bounced straight back to
 * the Keycloak login form by the auto-redirecting sign-in route.
 */
function SignedOut() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((state) => state.language)
  const navigate = useNavigate()

  return (
    <div className='grid h-svh place-items-center p-4'>
      <Card className='w-full max-w-sm gap-4'>
        <CardHeader className='text-center'>
          <CardTitle className='text-xl tracking-tight'>
            {t('signedOutTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auth.isAuthenticated ? (
            <Button
              size='lg'
              className='w-full'
              onClick={() => navigate({ to: '/', replace: true })}
            >
              {t('backToTenants')}
            </Button>
          ) : (
            <Button
              size='lg'
              className='w-full'
              onClick={() =>
                auth.signinRedirect(loginPageParams(resolvedTheme, language))
              }
            >
              <LogIn className='me-2 h-4 w-4' />
              {t('signInAgain')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
