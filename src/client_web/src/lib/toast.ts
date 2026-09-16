import { sileo } from 'sileo'
type ToastType = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = { description?: string }

// The message is the title; the kind of toast is its colour and icon, so
// no "Success" / "Something went wrong" line sits above it.
const show = (type: ToastType, message: string, options?: ToastOptions) =>
  sileo[type]({ title: message, description: options?.description })

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
