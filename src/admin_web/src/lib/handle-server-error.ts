import { problemReason } from '@ninja/web-core/problem'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = translate('somethingWentWrong')

  if (error && typeof error === 'object' && 'status' in error && Number(error.status) === 204) {
    errMsg = translate('contentNotFound')
  }

  // A ProblemDetails body names the cause; anything else keeps the generic line
  errMsg = problemReason(error) || errMsg

  toast.error(errMsg)
}
