import type { ReactNode } from 'react'
import { island } from './island'

type ToastType = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = {
  description?: string
  /** Stands in for the kind's own icon: a dish's photo, say */
  icon?: ReactNode
  /** One action on the toast, like Undo */
  action?: { label: string; onClick: () => void }
  /** How long it stays, ms */
  duration?: number
}

/** How long a message holds the island, ms: errors a little longer, to be read */
const HOLDS: Record<ToastType, number> = { success: 3200, info: 3200, warning: 3600, error: 4500 }

/**
 * What the app says, said on the island (lib/island.ts): the island morphs
 * into the message for a moment, then back to what the customer is waiting
 * on. The message is the title; its kind is its colour and icon, so no
 * "Success" / "Something went wrong" line sits above it.
 *
 * Say something only when the screen does not already: a dish flying into
 * the tray, a tick on a button or a page changing needs no toast as well.
 * Failures, choices (Undo) and news from the business do.
 */
const show = (type: ToastType, message: string, options?: ToastOptions) =>
  island.flash(
    {
      type,
      title: message,
      description: options?.description,
      ...(options?.icon !== undefined && { icon: options.icon }),
      ...(options?.action && { button: { title: options.action.label, onClick: options.action.onClick } }),
    },
    options?.duration ?? HOLDS[type]
  )

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  message: (message: string, options?: ToastOptions) => show('info', message, options),
  /** Takes a message away before its time (the id a call returned) */
  dismiss: (id: string) => {
    if (id) island.end()
  },
}
