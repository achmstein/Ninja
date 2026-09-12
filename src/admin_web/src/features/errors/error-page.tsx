import { useRouter } from '@tanstack/react-router'
import { useT, type TranslationKey } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/error-state'

type ErrorPageProps = {
  code: 401 | 403 | 404 | 500 | 503
  title: TranslationKey
  message: TranslationKey
}

/**
 * The full-screen error routes (401/403/404/500/503) share this one shape:
 * the code, what happened, and the way out. 503 offers a reload instead of
 * "go back", since going back lands on the same outage.
 */
export function ErrorPage({ code, title, message }: ErrorPageProps) {
  const t = useT()
  const { history } = useRouter()
  const outage = code === 503
  return (
    <ErrorState
      size='screen'
      code={code}
      title={t(title)}
      description={t(message)}
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
  return (
    <ErrorPage
      code={401}
      title='unauthorizedTitle'
      message='unauthorizedMessage'
    />
  )
}

export function ForbiddenError() {
  return (
    <ErrorPage code={403} title='forbiddenTitle' message='forbiddenMessage' />
  )
}

export function NotFoundError() {
  return (
    <ErrorPage code={404} title='notFoundTitle' message='notFoundMessage' />
  )
}

export function GeneralError() {
  return (
    <ErrorPage
      code={500}
      title='generalErrorTitle'
      message='generalErrorMessage'
    />
  )
}

export function MaintenanceError() {
  return (
    <ErrorPage
      code={503}
      title='maintenanceTitle'
      message='maintenanceMessage'
    />
  )
}
