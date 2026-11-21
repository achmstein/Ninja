import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { useTheme } from '@/context/theme-provider'
import { useLanguage } from '@/lib/i18n'
import { loginPageParams } from '@/config/oidc-config'
import { Loader2, LogIn } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  readCashierRoster,
  rememberPickedCashier,
} from '@/features/cashiers/roster'

export const Route = createFileRoute('/(auth)/signed-out')({
  component: SignedOut,
})

/**
 * Where the till rests with nobody signed in, and where one cashier hands
 * over to the next: Keycloak sends the browser here after sign-out. The
 * branch's till staff are here by name (features/cashiers/roster.ts); a tap
 * names that person to Keycloak, which asks for their PIN when they have
 * one and their password when they do not. A till that has never been
 * signed in to has no names yet and offers the plain sign-in.
 */
function SignedOut() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((state) => state.language)
  const navigate = useNavigate()
  const [roster] = useState(readCashierRoster)
  // The name being signed in, so its tile shows the wait and the rest stay still
  const [going, setGoing] = useState<string | null>(null)

  const signIn = (username: string | null) => {
    setGoing(username ?? '')
    rememberPickedCashier(username)
    void auth.signinRedirect({
      ...loginPageParams(resolvedTheme, language),
      ...(username ? { login_hint: username } : {}),
    })
  }

  if (auth.isAuthenticated) {
    return (
      <div className='grid h-svh place-items-center p-4'>
        <Card className='w-full max-w-sm gap-4'>
          <CardHeader className='text-center'>
            <CardTitle className='text-xl tracking-tight'>
              {t('signedOutTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size='lg'
              className='w-full'
              onClick={() => navigate({ to: '/', replace: true })}
            >
              {t('backToPos')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='grid min-h-svh place-items-center p-4'>
      <Card className='w-full max-w-md gap-4'>
        <CardHeader className='text-center'>
          <CardTitle className='text-xl tracking-tight'>
            {roster.length > 0 ? t('whoIsSelling') : t('signedOutTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          {roster.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {roster.map((cashier) => (
                <Button
                  key={cashier.username}
                  variant='outline'
                  size='lg'
                  className='h-auto min-h-16 px-2 py-2 text-base whitespace-normal'
                  disabled={going !== null}
                  onClick={() => signIn(cashier.username)}
                >
                  {going === cashier.username ? (
                    <Loader2 className='size-5 animate-spin' />
                  ) : (
                    <span className='line-clamp-2 break-words'>{cashier.name}</span>
                  )}
                </Button>
              ))}
            </div>
          )}
          <Button
            size='lg'
            variant={roster.length > 0 ? 'ghost' : 'default'}
            className='w-full'
            disabled={going !== null}
            onClick={() => signIn(null)}
          >
            <LogIn className='me-2 h-4 w-4' />
            {roster.length > 0 ? t('someoneElse') : t('signInAgain')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
