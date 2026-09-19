import { translate } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'

export function handleServerError(error: unknown) {
  // eslint-disable-next-line no-console
  console.log(error)
  toast.error(problemDetail(error) ?? translate('somethingWentWrong'))
}
