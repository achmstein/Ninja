import type { ReactNode } from 'react'
import { sileo } from 'sileo'
import { create } from 'zustand'

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

/** How long a toast stays when the caller does not say, ms */
const DEFAULT_MS = 3200

/**
 * The island: toasts live in the middle of the top bar, the slot the order
 * pill uses (routes/__root.tsx places the toaster there). One at a time: a
 * new one takes the island over from the last. While one is on, the pill
 * and the bar's brand and chips step aside (`useIsland`), and come back
 * when it goes.
 */
export const useIsland = create<{ toast: string | null }>(() => ({ toast: null }))

let away: number | null = null

// The message is the title; the kind of toast is its colour and icon, so
// no "Success" / "Something went wrong" line sits above it.
const show = (type: ToastType, message: string, options?: ToastOptions) => {
  sileo.clear('top-center')
  const duration = options?.duration ?? DEFAULT_MS
  const id = sileo[type]({
    title: message,
    description: options?.description,
    ...(options?.icon !== undefined && { icon: options.icon }),
    ...(options?.action && { button: { title: options.action.label, onClick: options.action.onClick } }),
    duration,
  })
  useIsland.setState({ toast: id })
  if (away != null) window.clearTimeout(away)
  away = window.setTimeout(() => leave(id), duration)
  return id
}

/** The island is free again once the toast on it has gone */
function leave(id: string) {
  if (useIsland.getState().toast === id) useIsland.setState({ toast: null })
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  message: (message: string, options?: ToastOptions) => show('info', message, options),
  /** Takes a toast away before its time (the id each call returns) */
  dismiss: (id: string) => {
    sileo.dismiss(id)
    leave(id)
  },
}
