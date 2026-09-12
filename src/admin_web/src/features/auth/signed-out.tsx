import { useNavigate } from '@tanstack/react-router'
import { loginPageParams } from '@/config/oidc-config'
import { LogIn } from 'lucide-react'
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
import { AuthLayout } from './auth-layout'

/**
 * Post-logout landing page. Keycloak sends the browser here after sign-out,
 * so the user gets a resting page instead of being bounced straight back to
 * the Keycloak login form by the auto-redirecting sign-in route.
 */
export function SignedOut() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((state) => state.language)
  const navigate = useNavigate()

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader className='text-center'>
          <CardTitle className='text-xl tracking-tight'>
            {t('signedOutTitle')}
          </CardTitle>
          <CardDescription>{t('signedOutDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {auth.isAuthenticated ? (
            <Button
              size='lg'
              className='w-full'
              onClick={() => navigate({ to: '/', replace: true })}
            >
              {t('backToDashboard')}
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
    </AuthLayout>
  )
}
