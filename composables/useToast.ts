/**
 * Toast composable (P2-10).
 *
 * Single global queue rendered by <AppToast> in app.vue / default layout.
 * Components push toasts via:
 *
 *   const toast = useToast()
 *   toast.success('Added to cart')
 *   toast.error('Stock unavailable')
 *   toast.info('Promo applied')
 *
 * Each toast auto-dismisses after `duration` ms (default 3500). Pass
 * { duration: 0 } for sticky toasts (caller must dismiss).
 */

export interface ToastAction {
  label: string
  handler: () => void
}

export interface ToastEntry {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration: number
  /** Optional inline action (e.g. "Undo" after a destructive tap). */
  action?: ToastAction
}

let nextId = 1

export function useToast() {
  const toasts = useState<ToastEntry[]>('app-toasts', () => [])

  function push(type: ToastEntry['type'], message: string, duration = 3500, action?: ToastAction) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, type, message, duration, action }]
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function clear() {
    toasts.value = []
  }

  return {
    toasts,
    success: (msg: string, duration?: number, action?: ToastAction) => push('success', msg, duration, action),
    error:   (msg: string, duration?: number, action?: ToastAction) => push('error', msg, duration, action),
    info:    (msg: string, duration?: number, action?: ToastAction) => push('info', msg, duration, action),
    warning: (msg: string, duration?: number, action?: ToastAction) => push('warning', msg, duration, action),
    dismiss,
    clear,
  }
}
