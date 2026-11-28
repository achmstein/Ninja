import { useLayoutEffect } from 'react'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sileo'
import { useBrandEffects } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { isStaleBuildError, reloadForNewBuild } from '@/lib/stale-build'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'

// Sileo only paints the pill background when it knows the theme (otherwise
// it falls back to a white fill that vanishes on light pages), and autopilot
// is the demo's expand/collapse physics for title + description toasts.
function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      // Top centre, not a bottom corner: the bottom corners sit exactly over
      // the sale pad's action bar (Add to ticket / Charge) and the settle
      // buttons, and a toast there steals the tap. The header's middle is
      // empty, so a toast over it covers nothing. Centred, so no RTL mirror.
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
      <h1 className='type-title'>404</h1>
      <p className='text-muted-foreground'>{t('contentNotFound')}</p>
      <Button asChild size='lg'>
        <Link to='/'>{t('backToFloor')}</Link>
      </Button>
    </div>
  )
}

function GeneralError({ error }: { error: unknown }) {
  const t = useT()
  // The screen's code is gone since a release: the new release is one reload
  // away, tried once before the cashier is shown anything
  const stale = isStaleBuildError(error)
  const detail =
    error instanceof Error
      ? [`${error.name}: ${error.message}`, error.stack?.split('\n').slice(1, 3).join(' ').trim()]
          .filter(Boolean)
          .join(' ')
          .slice(0, 400)
      : typeof error === 'string'
        ? error.slice(0, 400)
        : ''
  useLayoutEffect(() => {
    if (stale) reloadForNewBuild()
  }, [stale])
  return (
    <div className='flex h-svh flex-col items-center justify-center gap-4'>
      <h1 className='type-title'>{t('somethingWentWrong')}</h1>
      <Button size='lg' onClick={() => window.location.assign('/')}>
        {t('backToFloor')}
      </Button>
      {/* What went wrong, in the browser's own words: the one thing whoever
          looks into it needs, and a till has no console to read it from */}
      {detail && (
        <p dir='ltr' className='text-muted-foreground type-caption max-w-full px-6 text-center break-words select-text'>
          {detail}
        </p>
      )}
    </div>
  )
}

function RootComponent() {
  useBrandEffects()
  // index.html painted the loading screen; from here the app paints its own
  useLayoutEffect(() => {
    document.getElementById('splash')?.remove()
  }, [])
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
