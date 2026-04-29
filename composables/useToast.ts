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

export interface ToastEntry {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration: number
}

let nextId = 1

export function useToast() {
  const toasts = useState<ToastEntry[]>('app-toasts', () => [])

  function push(type: ToastEntry['type'], message: string, duration = 3500) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, type, message, duration }]
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
    success: (msg: string, duration?: number) => push('success', msg, duration),
    error:   (msg: string, duration?: number) => push('error', msg, duration),
    info:    (msg: string, duration?: number) => push('info', msg, duration),
    warning: (msg: string, duration?: number) => push('warning', msg, duration),
    dismiss,
    clear,
  }
}
