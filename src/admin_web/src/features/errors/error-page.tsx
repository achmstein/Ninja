import { useRouter } from '@tanstack/react-router'
import { useT, type TranslationKey } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/error-state'

type ErrorPageProps = {
  code: 401 | 403 | 404 | 500 | 503
  title: TranslationKey
}

/**
 * The full-screen error routes (401/403/404/500/503) share this one shape:
 * the code, what happened, and the way out. 503 offers a reload instead of
 * "go back", since going back lands on the same outage.
 */
function ErrorPage({ code, title }: ErrorPageProps) {
  const t = useT()
  const { history } = useRouter()
  const outage = code === 503
  return (
    <ErrorState
      size='screen'
      code={code}
      title={t(title)}
      home={!outage}
      actions={
        outage ? (
          <Button onClick={() => window.location.reload()}>
            {t('reloadPage')}
          </Button>
        ) : (
          <Button variant='outline' onClick={() => history.go(-1)}>
            {t('goBack')}
          </Button>
        )
      }
    />
  )
}

export function UnauthorisedError() {
  return <ErrorPage code={401} title='unauthorizedTitle' />
}

export function ForbiddenError() {
  return <ErrorPage code={403} title='forbiddenTitle' />
}

export function NotFoundError() {
  return <ErrorPage code={404} title='notFoundTitle' />
}

export function GeneralError() {
  return <ErrorPage code={500} title='generalErrorTitle' />
}

export function MaintenanceError() {
  return <ErrorPage code={503} title='maintenanceTitle' />
}
