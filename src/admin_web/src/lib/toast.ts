import { sileo } from 'sileo'
import { translate, type TranslationKey } from '@/lib/i18n'

type ToastType = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = { description?: string }

const titleKeys: Record<ToastType, TranslationKey> = {
  success: 'toastSuccess',
  error: 'toastError',
  info: 'toastInfo',
  warning: 'toastWarning',
}

// Sileo demo-style toasts: a short status title on the pill, the specific
// message as the description autopilot expands into view. Call sites keep
// the sonner shape — toast.success('Order confirmed') renders title
// "Success" with "Order confirmed" as the message. Passing an explicit
// description instead promotes the first argument to the title.
const show = (type: ToastType, message: string, options?: ToastOptions) =>
  sileo[type](
    options?.description
      ? { title: message, description: options.description }
      : { title: translate(titleKeys[type]), description: message }
  )

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    show('success', message, options),
  error: (message: string, options?: ToastOptions) =>
    show('error', message, options),
  info: (message: string, options?: ToastOptions) =>
    show('info', message, options),
  warning: (message: string, options?: ToastOptions) =>
    show('warning', message, options),
  message: (message: string, options?: ToastOptions) =>
    show('info', message, options),
}
