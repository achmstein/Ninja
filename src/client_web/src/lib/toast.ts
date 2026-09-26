import type { ReactNode } from 'react'
import { sileo } from 'sileo'
type ToastType = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = {
  description?: string
  /** Stands in for the kind's own icon: a dish's photo, say */
  icon?: ReactNode
  /** One action on the toast, like Undo */
  action?: { label: string; onClick: () => void }
  /** How long it stays, ms; the toaster's default when left out */
  duration?: number
}

// The message is the title; the kind of toast is its colour and icon, so
// no "Success" / "Something went wrong" line sits above it.
const show = (type: ToastType, message: string, options?: ToastOptions) =>
  sileo[type]({
    title: message,
    description: options?.description,
    ...(options?.icon !== undefined && { icon: options.icon }),
    ...(options?.action && { button: { title: options.action.label, onClick: options.action.onClick } }),
    ...(options?.duration !== undefined && { duration: options.duration }),
  })

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
  /** Takes a toast away before its time (the id each call returns) */
  dismiss: (id: string) => sileo.dismiss(id),
}
