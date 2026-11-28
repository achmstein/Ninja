import { sileo } from 'sileo'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type ToastOptions = { description?: string }

/**
 * The staff apps' toast (back office, till, kitchen, console), on Sileo: a short
 * status title on the pill ("Success", in the app's language, from `titleOf`) and
 * the specific message as the description it expands into view. Call sites keep
 * the sonner shape: toast.success('Order confirmed'). Passing an explicit
 * description instead promotes the first argument to the title.
 */
export function createToast(titleOf: (type: ToastType) => string) {
  const show = (type: ToastType, message: string, options?: ToastOptions) =>
    sileo[type](
      options?.description
        ? { title: message, description: options.description }
        : { title: titleOf(type), description: message }
    )

  return {
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    info: (message: string, options?: ToastOptions) => show('info', message, options),
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    message: (message: string, options?: ToastOptions) => show('info', message, options),
  }
}
