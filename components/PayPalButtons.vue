<template>
  <div>
    <ClientOnly>
      <div v-if="loadError" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
        {{ loadError }}
      </div>
      <div v-else-if="!sdkReady" class="flex items-center justify-center gap-2 py-4 text-text-secondary text-sm">
        <Icon name="ph:spinner" class="w-4 h-4 animate-spin" />
        <span>{{ $t('common.loading') }}</span>
      </div>
      <div v-show="sdkReady" ref="container" class="paypal-buttons-container" />
      <p v-if="processing" class="text-text-secondary text-xs text-center mt-2 flex items-center justify-center gap-1.5">
        <Icon name="ph:spinner" class="w-3.5 h-3.5 animate-spin" />
        <span>{{ $t('checkout.paypal_processing') }}</span>
      </p>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

/**
 * PayPal Smart Buttons.
 *
 * Owns the full PayPal flow:
 *   createOrder → POST /api/orders/create → return paypalOrderId
 *   onApprove   → POST /api/payments/paypal/capture-order → emit('success')
 *
 * The SDK is loaded lazily from the PayPal CDN. It is added to the page
 * exactly once — re-rendering the component reuses window.paypal.
 */

interface OrderPayload {
  items: Array<{ productId: string; sku: string; quantity: number }>
  shippingCode: string
  shippingAddress: Record<string, unknown>
  billingAddress?: Record<string, unknown>
  promoCode?: string
  notes?: string
  turnstileToken: string
}

const props = defineProps({
  orderPayload: { type: Object as PropType<OrderPayload>, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits<{
  success: [orderNumber: string]
  error: [message: string]
  cancel: []
}>()

const config = useRuntimeConfig()
const container = ref<HTMLDivElement>()
const sdkReady = ref(false)
const loadError = ref('')
const processing = ref(false)

const PAYPAL_SDK_ID = 'paypal-js-sdk'

function loadPayPalSdk(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if ((window as any).paypal) return Promise.resolve((window as any).paypal)

  const clientId = config.public.paypalClientId as string
  if (!clientId) {
    return Promise.reject(new Error('PayPal client id missing'))
  }
  const mode = (config.public.paypalMode as string) || 'sandbox'
  // Live and sandbox use the same SDK URL; the client-id distinguishes them.
  // Including `intent=capture&currency=EUR&components=buttons` keeps the SDK
  // bundle minimal and matches the server-side order intent.
  const url = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=EUR&intent=capture&components=buttons${mode === 'sandbox' ? '&debug=false' : ''}`

  const existing = document.getElementById(PAYPAL_SDK_ID) as HTMLScriptElement | null
  if (existing) {
    // Another instance kicked off the load; wait for it.
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve((window as any).paypal))
      existing.addEventListener('error', () => reject(new Error('PayPal SDK failed to load')))
    })
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = PAYPAL_SDK_ID
    s.src = url
    s.async = true
    s.onload = () => resolve((window as any).paypal)
    s.onerror = () => reject(new Error('PayPal SDK failed to load'))
    document.head.appendChild(s)
  })
}

async function render() {
  if (!container.value) return
  const paypal = (window as any).paypal
  if (!paypal?.Buttons) {
    loadError.value = 'PayPal SDK not available'
    return
  }

  // Clear any previous render (e.g., user switched payment method back and forth)
  container.value.innerHTML = ''

  paypal.Buttons({
    style: { color: 'gold', layout: 'vertical', label: 'paypal', shape: 'rect', height: 48 },

    // Called when the user clicks the PayPal button. We commit the local
    // order here (which reserves stock + creates the PayPal order) and hand
    // PayPal the resulting paypal order id.
    createOrder: async () => {
      if (props.disabled) {
        throw new Error('disabled')
      }
      try {
        const result = await $fetch<{ orderNumber: string; clientPayload: { paypalOrderId?: string } | null }>(
          '/api/orders/create',
          { method: 'POST', body: { ...props.orderPayload, paymentCode: 'paypal' } }
        )
        const paypalOrderId = result.clientPayload?.paypalOrderId
        if (!paypalOrderId) {
          throw new Error('Server did not return PayPal order id')
        }
        // Stash the orderNumber on the buttons instance so onApprove can reach it
        ;(window as any).__lastVitesseOrder = { orderNumber: result.orderNumber, paypalOrderId }
        return paypalOrderId
      } catch (err: any) {
        const msg = err?.data?.message || err?.message || 'Order creation failed'
        emit('error', msg)
        throw err
      }
    },

    // Called by PayPal after the customer approves in the popup. We capture
    // server-side; PayPal does NOT charge the customer until capture succeeds.
    onApprove: async () => {
      const stashed = (window as any).__lastVitesseOrder as { orderNumber: string; paypalOrderId: string } | undefined
      if (!stashed) {
        emit('error', 'Lost order reference during checkout')
        return
      }
      processing.value = true
      try {
        await $fetch('/api/payments/paypal/capture-order', {
          method: 'POST',
          body: { orderNumber: stashed.orderNumber, paypalOrderId: stashed.paypalOrderId },
        })
        emit('success', stashed.orderNumber)
      } catch (err: any) {
        const msg = err?.data?.message || err?.message || 'Capture failed'
        emit('error', msg)
      } finally {
        processing.value = false
      }
    },

    onCancel: () => {
      emit('cancel')
    },

    onError: (err: unknown) => {
      console.error('[PayPalButtons] SDK error', err)
      emit('error', 'PayPal error — please try again')
    },
  }).render(container.value).catch((err: unknown) => {
    console.error('[PayPalButtons] render error', err)
    loadError.value = 'Could not render PayPal buttons'
  })
}

onMounted(async () => {
  try {
    await loadPayPalSdk()
    sdkReady.value = true
    await nextTick()
    await render()
  } catch (err: any) {
    loadError.value = err?.message || 'Could not load PayPal'
  }
})

// Re-render when the cart payload changes meaningfully so the button always
// reflects the latest checkout state.
watch(() => props.orderPayload, async () => {
  if (sdkReady.value) await render()
}, { deep: true })
</script>
