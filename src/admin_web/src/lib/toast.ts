import { createToast, type ToastType } from '@ninja/web-core/toast'
import { translate, type TranslationKey } from '@/lib/i18n'

const titleKeys: Record<ToastType, TranslationKey> = {
  success: 'toastSuccess',
  error: 'toastError',
  info: 'toastInfo',
  warning: 'toastWarning',
}

/** The staff apps' toast (see @ninja/web-core/toast), titled in this app's language */
export const toast = createToast((type) => translate(titleKeys[type]))
