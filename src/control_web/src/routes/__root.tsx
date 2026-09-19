import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'

// Sileo only paints the pill background when it knows the theme (otherwise
// it falls back to a white fill that vanishes on light pages), and autopilot
// is the demo's expand/collapse physics for title + description toasts.
function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position='top-center'
      theme={resolvedTheme}
      options={{ autopilot: true }}
    />
  )
}

function NotFound() {
  const t = useT()
  return (
    <div className='flex h-svh flex-col items-center justify-center gap-4'>
      <h1 className='text-2xl font-bold'>404</h1>
      <p className='text-muted-foreground'>{t('contentNotFound')}</p>
      <Button asChild size='lg'>
        <Link to='/'>{t('backToTenants')}</Link>
      </Button>
    </div>
  )
}

function GeneralError() {
  const t = useT()
  return (
    <div className='flex h-svh flex-col items-center justify-center gap-4'>
      <h1 className='text-2xl font-bold'>{t('somethingWentWrong')}</h1>
      <Button size='lg' onClick={() => window.location.assign('/')}>
        {t('backToTenants')}
      </Button>
    </div>
  )
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <AppToaster />
    </>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: GeneralError,
})
