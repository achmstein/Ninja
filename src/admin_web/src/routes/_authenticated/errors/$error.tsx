import { createFileRoute } from '@tanstack/react-router'
import {
  ForbiddenError,
  GeneralError,
  MaintenanceError,
  NotFoundError,
  UnauthorisedError,
} from '@/features/errors/error-page'

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

function RouteComponent() {
  const { error } = Route.useParams()

  const errorMap: Record<string, React.ComponentType> = {
    unauthorized: UnauthorisedError,
    forbidden: ForbiddenError,
    'not-found': NotFoundError,
    'internal-server-error': GeneralError,
    'maintenance-error': MaintenanceError,
  }
  const ErrorComponent = errorMap[error] || NotFoundError

  return <ErrorComponent />
}
