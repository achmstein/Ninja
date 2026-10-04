import { translate } from '@/lib/i18n'
import { problemMessage } from '@/lib/problem'
import { toast } from '@/lib/toast'

/**
 * What a failed call says to the cashier when the screen has nothing better
 * to say: the server's refusal by its code, in the till's language, and never
 * the server's own English (its title or text).
 */
export function handleServerError(error: unknown) {
  // eslint-disable-next-line no-console
  console.log(error)

  if (error && typeof error === 'object' && 'status' in error && Number(error.status) === 204) {
    toast.error(translate('contentNotFound'))
    return
  }

  toast.error(problemMessage(error, translate, 'somethingWentWrong'))
}
