<script setup lang="ts">
/**
 * Cloudflare Turnstile.
 *
 * The widget is a convenience for the customer; the control is the server call
 * that verifies the token. This component's only real responsibility is that a
 * token is never reused: they are single-use, so `reset()` is exposed and every
 * failure path is expected to call it.
 *
 * With no site key configured the widget renders nothing and emits nothing —
 * the server then refuses the submission, which is the correct failure
 * direction for a misconfiguration.
 */
const token = defineModel<string>({ required: true })

const config = useRuntimeConfig()
const siteKey = computed(() => config.public.turnstileSiteKey as string)
const container = ref<HTMLElement | null>(null)
const widgetId = ref<string | null>(null)

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

function render(): void {
  if (!container.value || !window.turnstile || !siteKey.value) return
  widgetId.value = window.turnstile.render(container.value, {
    sitekey: siteKey.value,
    callback: (value: string) => {
      token.value = value
    },
    // A token that expires while the customer is still typing must not be
    // submitted — the server would reject it and the reason would look random.
    'expired-callback': () => {
      token.value = ''
    },
    'error-callback': () => {
      token.value = ''
    },
  })
}

function reset(): void {
  token.value = ''
  if (window.turnstile && widgetId.value) window.turnstile.reset(widgetId.value)
}

defineExpose({ reset })

onMounted(() => {
  if (!siteKey.value) return
  if (window.turnstile) return render()

  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.onload = render
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  if (window.turnstile && widgetId.value) window.turnstile.remove(widgetId.value)
})
</script>

<template>
  <div ref="container" />
</template>
